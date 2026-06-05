/**
 * @module aeo-auditor/checks/faq-schema
 * @description Validates FAQPage structured data in JSON-LD.
 *
 * FAQ schema is one of the most effective structured data types for
 * AI answer engines, as it provides pre-formatted question-answer pairs
 * that can be directly surfaced.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'faq-schema';
const cfg = aeoAuditorConfig.checks.faqSchema;

/** Minimum word count for an answer to be considered substantive. */
const MIN_ANSWER_WORDS = 20;

/**
 * Represents a single question-answer pair extracted from FAQPage schema.
 */
interface QAPair {
  /** The question text. */
  question: string;
  /** The answer text. */
  answer: string;
  /** Whether both question and answer are present. */
  isValid: boolean;
  /** Word count of the answer. */
  answerWordCount: number;
}

/**
 * Extract all JSON-LD blocks from the HTML.
 * @param html - Full page HTML.
 * @returns An array of parsed JSON objects. Malformed blocks are silently skipped.
 */
function extractJsonLdBlocks(html: string): unknown[] {
  const pattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: unknown[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      /* Malformed JSON-LD — skip silently. */
    }
  }

  return blocks;
}

/**
 * Strip HTML tags from a string, returning plain text.
 * @param html - Raw HTML string.
 * @returns Plain text with tags removed.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Find FAQPage schemas in parsed JSON-LD blocks and extract Q&A pairs.
 * @param blocks - Parsed JSON-LD objects.
 * @returns Array of extracted Q&A pairs.
 */
function extractFaqPairs(blocks: unknown[]): QAPair[] {
  const pairs: QAPair[] = [];

  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;

    /** Check if this is a FAQPage (or contains one via @graph). */
    if (record['@type'] === 'FAQPage') {
      extractQuestionsFromFaq(record, pairs);
    }

    /** Check @graph for nested FAQPage. */
    if (Array.isArray(record['@graph'])) {
      for (const item of record['@graph']) {
        if (item !== null && typeof item === 'object') {
          const graphItem = item as Record<string, unknown>;
          if (graphItem['@type'] === 'FAQPage') {
            extractQuestionsFromFaq(graphItem, pairs);
          }
        }
      }
    }
  }

  return pairs;
}

/**
 * Extract individual Question/Answer entries from a FAQPage object.
 * @param faqObj - A FAQPage JSON-LD object.
 * @param pairs - Accumulator array for extracted pairs.
 */
function extractQuestionsFromFaq(faqObj: Record<string, unknown>, pairs: QAPair[]): void {
  const mainEntity = faqObj['mainEntity'];
  if (!Array.isArray(mainEntity)) return;

  for (const item of mainEntity) {
    if (item === null || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;

    const entryType = entry['@type'];
    if (entryType !== 'Question') continue;

    const question = typeof entry['name'] === 'string' ? entry['name'].trim() : '';

    let answer = '';
    if (entry['acceptedAnswer'] !== null && typeof entry['acceptedAnswer'] === 'object') {
      const accepted = entry['acceptedAnswer'] as Record<string, unknown>;
      if (typeof accepted['text'] === 'string') {
        answer = stripTags(accepted['text']).trim();
      }
    }

    const answerWordCount = answer.split(/\s+/).filter((w) => w.length > 0).length;

    pairs.push({
      question,
      answer,
      isValid: question.length > 0 && answer.length > 0,
      answerWordCount,
    });
  }
}

/**
 * AEO check: FAQ Schema Validation.
 *
 * Validates that the page contains well-formed FAQPage structured data
 * with sufficient, valid, high-quality question-answer pairs.
 *
 * Scoring breakdown:
 * - 30 %: FAQPage schema is present.
 * - 30 %: Minimum number of Q&A pairs met.
 * - 20 %: All pairs have valid question + acceptedAnswer format.
 * - 20 %: Answers meet minimum word count quality threshold.
 */
export const faqSchemaCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Validates FAQPage JSON-LD structured data for quantity, format, and answer quality.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const blocks = extractJsonLdBlocks(context.html);
      const pairs = extractFaqPairs(blocks);
      const hasFaqSchema = pairs.length > 0 || blocks.some((b) => {
        if (b === null || typeof b !== 'object') return false;
        const r = b as Record<string, unknown>;
        return r['@type'] === 'FAQPage' || (
          Array.isArray(r['@graph']) && r['@graph'].some(
            (g: unknown) => g !== null && typeof g === 'object' && (g as Record<string, unknown>)['@type'] === 'FAQPage',
          )
        );
      });

      if (!hasFaqSchema) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'warning',
          message: 'No FAQPage schema found in JSON-LD structured data.',
          details: { hasFaqSchema: false, pairCount: 0 },
          fixSuggestion:
            'Add a FAQPage JSON-LD block with at least 3 Question/Answer pairs using the mainEntity property.',
        };
      }

      const validPairs = pairs.filter((p) => p.isValid);
      const qualityPairs = validPairs.filter((p) => p.answerWordCount >= MIN_ANSWER_WORDS);

      /** Score: has FAQ schema (30 %) */
      const schemaScore = 30;

      /** Score: minimum pairs met (30 %) */
      const pairsScore = validPairs.length >= cfg.minPairs
        ? 30
        : Math.round((validPairs.length / cfg.minPairs) * 30);

      /** Score: valid format (20 %) */
      const formatRatio = pairs.length > 0 ? validPairs.length / pairs.length : 0;
      const formatScore = Math.round(formatRatio * 20);

      /** Score: answer quality (20 %) */
      const qualityRatio = validPairs.length > 0 ? qualityPairs.length / validPairs.length : 0;
      const qualityScore = Math.round(qualityRatio * 20);

      const score = schemaScore + pairsScore + formatScore + qualityScore;
      const passed = score >= 60;

      const issues: string[] = [];
      if (validPairs.length < cfg.minPairs) {
        issues.push(
          `Found ${validPairs.length} valid Q&A pair(s) — need at least ${cfg.minPairs}.`,
        );
      }
      if (formatRatio < 1 && pairs.length > 0) {
        issues.push(
          `${pairs.length - validPairs.length} pair(s) are missing question text or acceptedAnswer.`,
        );
      }
      if (qualityRatio < 0.8 && validPairs.length > 0) {
        issues.push(
          `${validPairs.length - qualityPairs.length} answer(s) have fewer than ${MIN_ANSWER_WORDS} words.`,
        );
      }

      const message =
        issues.length === 0
          ? `FAQ schema is strong: ${validPairs.length} valid pair(s) with quality answers.`
          : `FAQ schema issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (validPairs.length < cfg.minPairs) {
        fixParts.push(`Add more Question entries to reach at least ${cfg.minPairs} Q&A pairs.`);
      }
      if (formatRatio < 1 && pairs.length > 0) {
        fixParts.push('Ensure every Question has a "name" and an "acceptedAnswer" with "text".');
      }
      if (qualityRatio < 0.8 && validPairs.length > 0) {
        fixParts.push(`Expand short answers to at least ${MIN_ANSWER_WORDS} words for depth.`);
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          hasFaqSchema: true,
          totalPairs: pairs.length,
          validPairs: validPairs.length,
          qualityPairs: qualityPairs.length,
          formatRatio: Math.round(formatRatio * 100),
          qualityRatio: Math.round(qualityRatio * 100),
          questions: validPairs.slice(0, 10).map((p) => p.question),
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
        message: `FAQ schema check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure JSON-LD blocks contain valid FAQPage schema.',
      };
    }
  },
};
