/**
 * @module aeo-auditor/checks/direct-answer
 * @description Validates that the page opens with an AI-quotable direct answer.
 *
 * AI answer engines (Perplexity, Google AI Overviews, ChatGPT Browse) extract
 * short, definitive statements from the top of content to surface as citations.
 * This check ensures the page leads with such a statement.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'direct-answer';
const cfg = aeoAuditorConfig.checks.directAnswer;

/**
 * Filler phrases that weaken a page's opening for AI quoting.
 * Matched case-insensitively against the first sentence.
 */
const FILLER_PREFIXES: readonly string[] = [
  'in this article',
  'welcome to',
  'today we will',
  'in this post',
  'in this guide',
  'let me tell you',
  'have you ever wondered',
  'thanks for visiting',
  'hello and welcome',
  'in this tutorial',
] as const;

/**
 * Definitional verb patterns that signal a concise, quotable answer.
 * Each pattern is tested as a case-insensitive word-boundary regex.
 */
const DEFINITIVE_PATTERNS: readonly RegExp[] = [
  /\bis\b/i,
  /\bare\b/i,
  /\bmeans\b/i,
  /\brefers\s+to\b/i,
  /\bdefined\s+as\b/i,
  /\brepresents\b/i,
  /\bdescribes\b/i,
  /\bdenotes\b/i,
] as const;

/**
 * Strip HTML tags from a string, returning plain text.
 * @param html - Raw HTML string.
 * @returns Plain text with tags removed and whitespace normalised.
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the leading text from the main content area of the page.
 *
 * Searches in order: `<main>`, `<article>`, first `<p>` tags.
 * Falls back to the raw body content when none of the above are found.
 *
 * @param html - Full page HTML.
 * @param maxWords - Maximum number of words to extract.
 * @returns The leading text trimmed to `maxWords`.
 */
function extractLeadingContent(html: string, maxWords: number): string {
  /** Try semantic containers first, then fall back to paragraphs. */
  const containerPatterns: RegExp[] = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const pattern of containerPatterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const text = stripTags(match[1]);
      if (text.length > 0) {
        return text.split(/\s+/).slice(0, maxWords).join(' ');
      }
    }
  }

  /** Fall back to collecting text from <p> tags. */
  const pTagPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs: string[] = [];
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pTagPattern.exec(html)) !== null) {
    const text = stripTags(pMatch[1]).trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length > 0) {
    const combined = paragraphs.join(' ');
    return combined.split(/\s+/).slice(0, maxWords).join(' ');
  }

  /** Last resort — use rawContent / stripped body. */
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const bodyText = bodyMatch ? stripTags(bodyMatch[1]) : stripTags(html);
  return bodyText.split(/\s+/).slice(0, maxWords).join(' ');
}

/**
 * Determine whether the opening text contains a definitive, quotable statement.
 * @param text - Leading content text.
 * @returns `true` if at least one definitional verb pattern matches.
 */
function hasDefinitiveStatement(text: string): boolean {
  return DEFINITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check whether the opening text begins with known filler phrases.
 * @param text - Leading content text.
 * @returns `true` if the text starts with a filler phrase.
 */
function startsWithFiller(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return FILLER_PREFIXES.some((filler) => lower.startsWith(filler));
}

/**
 * AEO check: Direct Answer Quotability.
 *
 * Ensures the page opens with a concise, definitive statement that an AI
 * answer engine can extract and cite verbatim.
 *
 * Scoring breakdown:
 * - 40 %: Contains a definitive answer statement.
 * - 30 %: Answer is within the maximum word limit (concise).
 * - 30 %: Opening does not start with filler phrases.
 */
export const directAnswerCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Checks that the page opens with a concise, AI-quotable direct answer within the first 150 words.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const leadingText = extractLeadingContent(context.html, cfg.placement);

      if (leadingText.length === 0) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No extractable content found on the page.',
          details: { leadingText: '' },
          fixSuggestion:
            'Add semantic HTML containers (<main>, <article>) with substantive opening paragraphs.',
        };
      }

      /** Extract the first sentence (up to maxWords) for the conciseness check. */
      const firstSentenceMatch = leadingText.match(/^[^.!?]+[.!?]/);
      const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : leadingText;
      const firstSentenceWordCount = firstSentence.split(/\s+/).length;

      const hasAnswer = hasDefinitiveStatement(leadingText);
      const isConcise = firstSentenceWordCount <= cfg.maxWords;
      const hasFiller = startsWithFiller(leadingText);

      let score = 0;
      if (hasAnswer) score += 40;
      if (isConcise) score += 30;
      if (!hasFiller) score += 30;

      const passed = score >= 70;

      const issues: string[] = [];
      if (!hasAnswer) {
        issues.push('No definitive statement (is/are/means/refers to/defined as) found in the opening.');
      }
      if (!isConcise) {
        issues.push(
          `First sentence is ${firstSentenceWordCount} words — exceeds the ${cfg.maxWords}-word quotability limit.`,
        );
      }
      if (hasFiller) {
        issues.push('Opening begins with filler text that weakens AI quotability.');
      }

      const message =
        issues.length === 0
          ? 'Page opens with a concise, definitive, AI-quotable direct answer.'
          : `Direct answer issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (!hasAnswer) {
        fixParts.push(
          'Open your content with a clear definitional statement such as "X is ..." or "X refers to ...".',
        );
      }
      if (!isConcise) {
        fixParts.push(`Shorten the first sentence to ${cfg.maxWords} words or fewer.`);
      }
      if (hasFiller) {
        fixParts.push('Remove filler openings like "In this article" or "Welcome to".');
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'critical',
        message,
        details: {
          hasDefinitiveAnswer: hasAnswer,
          isConcise,
          hasFiller,
          firstSentenceWordCount,
          leadingTextPreview: leadingText.slice(0, 200),
        },
        fixSuggestion: fixParts.length > 0 ? fixParts.join(' ') : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Direct answer check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML with readable content.',
      };
    }
  },
};
