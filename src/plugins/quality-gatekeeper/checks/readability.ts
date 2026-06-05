/**
 * @fileoverview Flesch-Kincaid readability check for the Quality Gatekeeper plugin.
 *
 * Implements a simplified but functional readability scorer that:
 * 1. Splits raw content into sentences, words, and syllables.
 * 2. Computes the Flesch-Kincaid Reading Ease score.
 * 3. Maps the FK score to a 0-100 quality score against the configured minimum.
 *
 * The syllable counter uses vowel-group heuristics — accurate enough for
 * English-language content without requiring an external NLP library.
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.readability;

/** Characters that delimit sentence boundaries. */
const SENTENCE_TERMINATORS = /[.!?]+/g;

/** Pattern matching a single vowel group inside a word (used for syllable counting). */
const VOWEL_GROUP = /[aeiouy]+/gi;

/** Pattern matching contiguous whitespace for word splitting. */
const WORD_SPLITTER = /\s+/;

/** Minimum word count required for a meaningful readability analysis. */
const MIN_WORDS_FOR_ANALYSIS = 10;

/**
 * Count the number of syllables in a single English word.
 *
 * Uses a vowel-group heuristic:
 * 1. Count contiguous vowel groups.
 * 2. Subtract 1 for a trailing silent-e (unless the word is very short).
 * 3. Ensure every word has at least 1 syllable.
 *
 * @param word - A single word (letters only, already lowercased).
 * @returns The estimated number of syllables (>= 1).
 */
function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (lower.length === 0) {
    return 0;
  }

  const matches = lower.match(VOWEL_GROUP);
  let count = matches ? matches.length : 1;

  // Trailing silent-e: e.g. "cake" → 1 syllable, not 2
  if (lower.endsWith('e') && count > 1 && lower.length > 2) {
    count -= 1;
  }

  // Words ending in "le" preceded by a consonant often add a syllable (e.g. "table")
  if (
    lower.endsWith('le') &&
    lower.length > 2 &&
    !/[aeiouy]/.test(lower[lower.length - 3])
  ) {
    count += 1;
  }

  return Math.max(count, 1);
}

/**
 * Extract words from raw text content.
 *
 * Strips non-alphabetic noise and splits on whitespace.
 *
 * @param text - Raw content string.
 * @returns Array of non-empty word strings.
 */
function extractWords(text: string): string[] {
  return text
    .split(WORD_SPLITTER)
    .map((w) => w.replace(/[^a-zA-Z'-]/g, ''))
    .filter((w) => w.length > 0);
}

/**
 * Count the number of sentences in text.
 *
 * Splits on sentence-ending punctuation (`.`, `!`, `?`) and filters
 * empty segments.  Ensures at least 1 sentence is returned.
 *
 * @param text - Raw content string.
 * @returns Sentence count (>= 1).
 */
function countSentences(text: string): number {
  const segments = text
    .split(SENTENCE_TERMINATORS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(segments.length, 1);
}

/**
 * Compute the Flesch-Kincaid Reading Ease score.
 *
 * Formula: 206.835 − 1.015 × (words / sentences) − 84.6 × (syllables / words)
 *
 * The result is clamped to [0, 100] for sanity.
 *
 * @param totalWords     - Total number of words.
 * @param totalSentences - Total number of sentences.
 * @param totalSyllables - Total number of syllables.
 * @returns FK Reading Ease score, clamped to [0, 100].
 */
function computeFleschKincaid(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number,
): number {
  if (totalWords === 0 || totalSentences === 0) {
    return 0;
  }
  const raw =
    206.835 -
    1.015 * (totalWords / totalSentences) -
    84.6 * (totalSyllables / totalWords);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Map a Flesch-Kincaid score to the plugin's 0-100 quality score.
 *
 * If the FK score meets or exceeds the configured minimum, quality is 100.
 * Otherwise, it scales linearly down to 0 at FK = 0.
 *
 * @param fkScore - The computed Flesch-Kincaid Reading Ease score.
 * @param minFK   - The configured minimum FK score for full marks.
 * @returns Quality score in [0, 100].
 */
function mapToQualityScore(fkScore: number, minFK: number): number {
  if (minFK <= 0) {
    return 100;
  }
  if (fkScore >= minFK) {
    return 100;
  }
  return Math.round((fkScore / minFK) * 100);
}

/**
 * Readability plugin check.
 *
 * Uses the Flesch-Kincaid Reading Ease formula to evaluate how accessible
 * the content is to a general audience.  Content that scores below the
 * configured `minFleschKincaid` receives a proportionally lower quality score.
 */
export const readabilityCheck: PluginCheck = {
  name: 'readability',
  description:
    'Evaluates content readability using the Flesch-Kincaid Reading Ease formula. Higher scores indicate content that is easier to read.',
  severity: 'critical',
  weight: config.weight,

  /**
   * Execute the readability check against the provided context.
   *
   * @param context - The check context containing raw content and metadata.
   * @returns A CheckResult with the readability score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'readability';

    try {
      const { rawContent } = context;

      // Edge case: empty content
      if (!rawContent || rawContent.trim().length === 0) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No content available for readability analysis.',
          details: {
            fleschKincaid: 0,
            words: 0,
            sentences: 0,
            syllables: 0,
          },
          fixSuggestion: 'Add meaningful text content to the page.',
        };
      }

      const words = extractWords(rawContent);
      const totalWords = words.length;

      // Edge case: very short content
      if (totalWords < MIN_WORDS_FOR_ANALYSIS) {
        return {
          checkName,
          score: 50,
          passed: false,
          severity: 'critical',
          message: `Content too short for reliable readability analysis (${totalWords} words; minimum ${MIN_WORDS_FOR_ANALYSIS}).`,
          details: {
            fleschKincaid: null,
            words: totalWords,
            sentences: countSentences(rawContent),
            syllables: words.reduce((sum, w) => sum + countSyllables(w), 0),
          },
          fixSuggestion: `Expand the content to at least ${MIN_WORDS_FOR_ANALYSIS} words for a meaningful readability assessment.`,
        };
      }

      const totalSentences = countSentences(rawContent);
      const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
      const fkScore = computeFleschKincaid(totalWords, totalSentences, totalSyllables);
      const qualityScore = mapToQualityScore(fkScore, config.minFleschKincaid);
      const passed = qualityScore >= 60;

      const fkRounded = Math.round(fkScore * 10) / 10;

      let message: string;
      if (fkScore >= config.minFleschKincaid) {
        message = `Content is easy to read (FK Reading Ease: ${fkRounded}).`;
      } else if (fkScore >= config.minFleschKincaid * 0.5) {
        message = `Content readability is moderate (FK Reading Ease: ${fkRounded}). Consider simplifying sentence structure.`;
      } else {
        message = `Content is difficult to read (FK Reading Ease: ${fkRounded}). Simplify language and shorten sentences.`;
      }

      const result: CheckResult = {
        checkName,
        score: qualityScore,
        passed,
        severity: 'critical',
        message,
        details: {
          fleschKincaid: fkRounded,
          words: totalWords,
          sentences: totalSentences,
          syllables: totalSyllables,
          avgWordsPerSentence: Math.round((totalWords / totalSentences) * 10) / 10,
          avgSyllablesPerWord: Math.round((totalSyllables / totalWords) * 100) / 100,
          minFleschKincaid: config.minFleschKincaid,
        },
      };

      if (!passed) {
        result.fixSuggestion =
          'Use shorter sentences, simpler words, and active voice to improve readability. ' +
          `Target a Flesch-Kincaid Reading Ease score of ${config.minFleschKincaid} or above.`;
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during readability analysis';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Readability check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the content is valid text.',
      };
    }
  },
};
