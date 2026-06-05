/**
 * @module aeo-auditor/checks/conversational-query
 * @description Validates that content aligns with conversational/natural-language queries.
 *
 * AI answer engines surface content that directly addresses the questions
 * users ask in natural language. This check ensures headings contain
 * question patterns and that the content provides clear answers.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'conversational-query';
const cfg = aeoAuditorConfig.checks.conversationalQuery;

/**
 * Question-initiating words used in natural language queries.
 */
const QUESTION_WORDS: readonly string[] = [
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'can',
  'does',
  'is',
  'are',
  'should',
  'will',
  'which',
  'do',
] as const;

/**
 * Regex that matches a natural-language question pattern.
 * Matches question words at the start of a string, followed by content, ending with `?`.
 */
const QUESTION_PATTERN = new RegExp(
  `^\\s*(${QUESTION_WORDS.join('|')})\\b[^?]*\\?`,
  'i',
);

/**
 * Regex to match question-like headings (may or may not end with `?`).
 */
const HEADING_QUESTION_PATTERN = new RegExp(
  `^\\s*(${QUESTION_WORDS.join('|')})\\b`,
  'i',
);

/**
 * Strip HTML tags from a string, returning plain text.
 * @param html - Raw HTML string.
 * @returns Plain text with tags removed.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract text from heading tags (h2–h6) in the HTML.
 * @param html - Full page HTML.
 * @returns Array of heading text strings.
 */
function extractHeadings(html: string): string[] {
  const pattern = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi;
  const headings: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text.length > 0) {
      headings.push(text);
    }
  }

  return headings;
}

/**
 * Count the number of distinct question words used across all question-patterned headings.
 * @param headings - Array of heading text strings.
 * @returns The number of distinct question-word categories used.
 */
function countQuestionWordDiversity(headings: string[]): number {
  const found = new Set<string>();

  for (const heading of headings) {
    for (const word of QUESTION_WORDS) {
      const pattern = new RegExp(`^\\s*${word}\\b`, 'i');
      if (pattern.test(heading)) {
        found.add(word);
        break;
      }
    }
  }

  return found.size;
}

/**
 * Check whether question-patterned headings are followed by substantive answer paragraphs.
 *
 * A "substantive answer" is defined as a paragraph (or content block) of at least
 * 10 words immediately following the heading.
 *
 * @param html - Full page HTML.
 * @returns The fraction (0-1) of question headings followed by answers.
 */
function questionAnswerPairRatio(html: string): number {
  /**
   * Match heading + the next block of text (up to the next heading or end).
   * We look for h2–h6 followed by any content before the next heading.
   */
  const sectionPattern = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/gi;
  let questionHeadings = 0;
  let answeredQuestions = 0;
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(html)) !== null) {
    const headingText = stripTags(match[1]).trim();
    const sectionContent = stripTags(match[2]).trim();

    if (HEADING_QUESTION_PATTERN.test(headingText)) {
      questionHeadings += 1;
      const wordCount = sectionContent.split(/\s+/).filter((w) => w.length > 0).length;
      if (wordCount >= 10) {
        answeredQuestions += 1;
      }
    }
  }

  return questionHeadings === 0 ? 0 : answeredQuestions / questionHeadings;
}

/**
 * AEO check: Conversational Query Alignment.
 *
 * Ensures the page addresses natural-language questions that users
 * ask AI assistants, with question-patterned headings and substantive answers.
 *
 * Scoring breakdown:
 * - 40 %: At least one heading contains a question pattern.
 * - 30 %: Question-word diversity (multiple question types addressed).
 * - 30 %: Question headings are followed by substantive answer content.
 */
export const conversationalQueryCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Checks that content headings address natural-language conversational queries with substantive answers.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const headings = extractHeadings(context.html);

      if (headings.length === 0) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'warning',
          message: 'No headings (h2–h6) found on the page.',
          details: { headingCount: 0, questionHeadings: 0 },
          fixSuggestion:
            'Structure your content with descriptive h2–h6 headings, using question patterns like "What is X?" or "How does Y work?".',
        };
      }

      const questionHeadings = headings.filter((h) => HEADING_QUESTION_PATTERN.test(h));
      const hasQuestionInHeadings = questionHeadings.length > 0;
      const diversity = countQuestionWordDiversity(questionHeadings);
      const qaRatio = questionAnswerPairRatio(context.html);

      /** Also check the raw content body for question patterns. */
      const contentQuestions = context.rawContent
        .split(/[.!?\n]/)
        .filter((s) => QUESTION_PATTERN.test(s.trim()));

      /** Score: question in headings (40 %) */
      const headingScore = hasQuestionInHeadings
        ? Math.min(40, Math.round((questionHeadings.length / Math.max(headings.length * 0.3, 1)) * 40))
        : contentQuestions.length > 0
          ? 10
          : 0;

      /** Score: diversity (30 %) — target at least 3 distinct question words. */
      const diversityScore = Math.min(30, Math.round((diversity / 3) * 30));

      /** Score: Q&A pairs (30 %) */
      const qaScore = Math.round(qaRatio * 30);

      const score = Math.min(100, headingScore + diversityScore + qaScore);
      const passed = score >= 50;

      const issues: string[] = [];
      if (!hasQuestionInHeadings) {
        issues.push('No headings use question patterns (what, how, why, etc.).');
      }
      if (diversity < 2) {
        issues.push(`Question-word diversity is low (${diversity} type(s) used).`);
      }
      if (qaRatio < 0.5) {
        issues.push(
          `Only ${Math.round(qaRatio * 100)}% of question headings are followed by substantive answers.`,
        );
      }

      const message =
        issues.length === 0
          ? `Content aligns well with conversational queries: ${questionHeadings.length} question heading(s), ${diversity} question type(s).`
          : `Conversational query issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (!hasQuestionInHeadings) {
        fixParts.push(
          'Add h2/h3 headings phrased as natural-language questions (e.g., "What is X?", "How does Y work?").',
        );
      }
      if (diversity < 2) {
        fixParts.push('Use diverse question words — mix what, how, why, when, etc.');
      }
      if (qaRatio < 0.5) {
        fixParts.push('Ensure every question heading is immediately followed by a clear, substantive answer (≥ 10 words).');
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          totalHeadings: headings.length,
          questionHeadingCount: questionHeadings.length,
          questionHeadings: questionHeadings.slice(0, 10),
          questionWordDiversity: diversity,
          qaAnswerRatio: Math.round(qaRatio * 100),
          contentQuestionCount: contentQuestions.length,
        },
        fixSuggestion: fixParts.length > 0 ? fixParts.join(' ') : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Conversational query check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML with heading elements.',
      };
    }
  },
};
