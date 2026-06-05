/**
 * @fileoverview Originality check for the Quality Gatekeeper plugin.
 *
 * Detects duplicate/repetitive content by generating n-grams from the raw text
 * and computing the ratio of unique n-grams to total n-grams.  A high
 * duplication ratio indicates either copy-pasted or highly repetitive content.
 *
 * This is a local, self-contained originality heuristic — it does not compare
 * against external corpora.  Cross-document plagiarism detection should be
 * handled by a separate engine-level service.
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.originality;

/** Minimum word count required for meaningful n-gram analysis. */
const MIN_WORDS_FOR_ANALYSIS = 20;

/**
 * Normalise and tokenise raw content into lowercase words.
 *
 * Strips punctuation and collapses whitespace so that n-gram comparison
 * is case- and punctuation-insensitive.
 *
 * @param text - Raw content string.
 * @returns Array of normalised word tokens.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Generate n-grams from an array of tokens.
 *
 * @param tokens - Array of word tokens.
 * @param n      - Size of each n-gram.
 * @returns Array of n-gram strings (tokens joined by spaces).
 */
function generateNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) {
    return [];
  }

  const ngrams: string[] = [];
  const limit = tokens.length - n + 1;

  for (let i = 0; i < limit; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }

  return ngrams;
}

/**
 * Calculate the uniqueness ratio of an n-gram set.
 *
 * @param ngrams - Array of n-gram strings (may contain duplicates).
 * @returns Ratio in [0, 1] where 1 = all unique, 0 = all identical.
 */
function computeUniquenessRatio(ngrams: string[]): number {
  if (ngrams.length === 0) {
    return 1;
  }

  const unique = new Set(ngrams);
  return unique.size / ngrams.length;
}

/**
 * Map a uniqueness ratio to a quality score.
 *
 * When the uniqueness ratio is at or above (1 − maxDuplicateRatio), the score
 * is 100.  Below that threshold it scales linearly to 0.
 *
 * @param uniquenessRatio    - Ratio of unique n-grams (0-1).
 * @param maxDuplicateRatio  - Configured maximum duplicate ratio.
 * @returns Quality score in [0, 100].
 */
function mapToQualityScore(uniquenessRatio: number, maxDuplicateRatio: number): number {
  const score = Math.round(Math.min(uniquenessRatio, 1) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Originality plugin check.
 *
 * Generates word-level n-grams and measures the ratio of unique n-grams
 * to total n-grams.  A low uniqueness ratio suggests the content is
 * repetitive or contains large duplicated blocks.
 */
export const originalityCheck: PluginCheck = {
  name: 'originality',
  description:
    'Detects repetitive or duplicated content by measuring n-gram uniqueness. Flags content where the duplicate n-gram ratio exceeds the configured threshold.',
  severity: 'critical',
  weight: config.weight,

  /**
   * Execute the originality check.
   *
   * @param context - The check context containing raw content.
   * @returns A CheckResult with the originality score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'originality';

    try {
      const { rawContent } = context;

      // Edge case: empty content
      if (!rawContent || rawContent.trim().length === 0) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No content available for originality analysis.',
          details: {
            totalNgrams: 0,
            uniqueNgrams: 0,
            uniquenessRatio: 0,
            ngramSize: config.ngramSize,
          },
          fixSuggestion: 'Add original content to the page.',
        };
      }

      const tokens = tokenise(rawContent);

      // Edge case: too few words for n-gram analysis
      if (tokens.length < MIN_WORDS_FOR_ANALYSIS) {
        return {
          checkName,
          score: 75,
          passed: true,
          severity: 'critical',
          message: `Content too short for reliable originality analysis (${tokens.length} words; minimum ${MIN_WORDS_FOR_ANALYSIS}).`,
          details: {
            totalTokens: tokens.length,
            totalNgrams: 0,
            uniqueNgrams: 0,
            uniquenessRatio: null,
            ngramSize: config.ngramSize,
          },
          fixSuggestion:
            'Expand the content to enable meaningful originality assessment.',
        };
      }

      const ngrams = generateNgrams(tokens, config.ngramSize);
      const uniqueCount = new Set(ngrams).size;
      const uniquenessRatio = computeUniquenessRatio(ngrams);
      const duplicateRatio = 1 - uniquenessRatio;
      const qualityScore = mapToQualityScore(uniquenessRatio, config.maxDuplicateRatio);
      const passed = duplicateRatio <= config.maxDuplicateRatio;

      let message: string;
      if (duplicateRatio <= config.maxDuplicateRatio * 0.5) {
        message = `Content shows strong originality (${Math.round(uniquenessRatio * 100)}% unique ${config.ngramSize}-grams).`;
      } else if (duplicateRatio <= config.maxDuplicateRatio) {
        message = `Content originality is acceptable (${Math.round(uniquenessRatio * 100)}% unique ${config.ngramSize}-grams).`;
      } else {
        message = `Content has excessive repetition (${Math.round(duplicateRatio * 100)}% duplicate ${config.ngramSize}-grams). Rewrite repeated sections.`;
      }

      const result: CheckResult = {
        checkName,
        score: qualityScore,
        passed,
        severity: 'critical',
        message,
        details: {
          totalNgrams: ngrams.length,
          uniqueNgrams: uniqueCount,
          uniquenessRatio: Math.round(uniquenessRatio * 1000) / 1000,
          duplicateRatio: Math.round(duplicateRatio * 1000) / 1000,
          ngramSize: config.ngramSize,
          maxDuplicateRatio: config.maxDuplicateRatio,
          totalTokens: tokens.length,
        },
      };

      if (!passed) {
        result.fixSuggestion =
          `Reduce repetitive phrasing. The duplicate ${config.ngramSize}-gram ratio is ` +
          `${Math.round(duplicateRatio * 100)}% (maximum allowed: ${Math.round(config.maxDuplicateRatio * 100)}%). ` +
          'Rephrase repeated sections and vary your vocabulary.';
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during originality analysis';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Originality check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the content is valid text.',
      };
    }
  },
};
