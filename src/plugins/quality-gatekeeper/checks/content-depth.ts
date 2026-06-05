/**
 * @fileoverview Content depth check for the Quality Gatekeeper plugin.
 *
 * Evaluates whether content has sufficient depth by analysing three dimensions:
 * 1. **Word count** — does the content meet the minimum for its type?
 * 2. **Heading distribution** — are headings used to break up long sections?
 * 3. **Paragraph variety** — are paragraphs neither too short nor too long?
 *
 * The final score is a weighted combination:
 *   word-count factor (60%) + heading distribution (20%) + paragraph variety (20%)
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.contentDepth;

/**
 * Minimum word counts per content type.
 * Types not listed here fall back to `page`.
 */
const MIN_WORDS_BY_TYPE: Readonly<Record<string, number>> = {
  article: 800,
  page: 300,
  landing: 500,
  'landing-page': 500,
  tool: 200,
};

/** Recommended maximum words between headings. */
const MAX_WORDS_PER_HEADING_SECTION = 300;

/** Ideal average paragraph word-count range. */
const IDEAL_PARAGRAPH_MIN = 40;
const IDEAL_PARAGRAPH_MAX = 200;

/** Regex that matches HTML heading tags (h1-h6). */
const HEADING_REGEX = /<h[1-6][^>]*>/gi;

/** Regex that matches HTML paragraph tags and captures inner content. */
const PARAGRAPH_REGEX = /<p[^>]*>([\s\S]*?)<\/p>/gi;

/** Regex to strip all HTML tags. */
const STRIP_HTML = /<[^>]*>/g;

/**
 * Resolve the minimum word count for a given content type.
 *
 * @param contentType - The content type string from metadata.
 * @returns The minimum word count threshold.
 */
function resolveMinWords(contentType: string): number {
  const normalised = contentType.toLowerCase().trim();
  return MIN_WORDS_BY_TYPE[normalised] ?? config.minWordsPage;
}

/**
 * Calculate the word-count factor (0-100).
 *
 * Full marks if word count meets or exceeds the minimum.
 * Linear scale-down to 0 when word count is 0.
 *
 * @param wordCount - Actual word count.
 * @param minWords  - Required minimum word count.
 * @returns Score in [0, 100].
 */
function scoreWordCount(wordCount: number, minWords: number): number {
  if (minWords <= 0) {
    return 100;
  }
  if (wordCount >= minWords) {
    return 100;
  }
  return Math.round((wordCount / minWords) * 100);
}

/**
 * Calculate the heading distribution score (0-100).
 *
 * At least 1 heading per {@link MAX_WORDS_PER_HEADING_SECTION} words is expected.
 * Short content (< MAX_WORDS_PER_HEADING_SECTION) gets full marks if it has at
 * least one heading.
 *
 * @param headingCount - Number of headings found in the HTML.
 * @param wordCount    - Total word count.
 * @returns Score in [0, 100].
 */
function scoreHeadingDistribution(headingCount: number, wordCount: number): number {
  if (wordCount <= MAX_WORDS_PER_HEADING_SECTION) {
    // Short content doesn't need multiple headings — one is nice but not critical.
    return headingCount >= 1 ? 100 : 70;
  }

  const expectedHeadings = Math.floor(wordCount / MAX_WORDS_PER_HEADING_SECTION);
  if (headingCount >= expectedHeadings) {
    return 100;
  }
  if (expectedHeadings === 0) {
    return 100;
  }
  return Math.round((headingCount / expectedHeadings) * 100);
}

/**
 * Calculate the paragraph variety score (0-100).
 *
 * Measures whether paragraphs have a healthy average length — not too dense
 * (wall-of-text) and not too fragmented.
 *
 * @param paragraphWordCounts - Word counts of individual paragraphs.
 * @returns Score in [0, 100].
 */
function scoreParagraphVariety(paragraphWordCounts: number[]): number {
  if (paragraphWordCounts.length === 0) {
    // No <p> tags found — likely raw content or unusual markup.
    return 50;
  }

  const totalWords = paragraphWordCounts.reduce((a, b) => a + b, 0);
  const avgLength = totalWords / paragraphWordCounts.length;

  if (avgLength >= IDEAL_PARAGRAPH_MIN && avgLength <= IDEAL_PARAGRAPH_MAX) {
    return 100;
  }

  // Outside the ideal range — calculate how far off we are.
  if (avgLength < IDEAL_PARAGRAPH_MIN) {
    // Too short — fragmented writing.
    return Math.max(0, Math.round((avgLength / IDEAL_PARAGRAPH_MIN) * 100));
  }

  // Too long — dense blocks of text.
  // Scale down from 100 at 200 to 0 at 600.
  const overshoot = avgLength - IDEAL_PARAGRAPH_MAX;
  const maxOvershoot = IDEAL_PARAGRAPH_MAX * 2; // 400 words over = 0
  return Math.max(0, Math.round(100 - (overshoot / maxOvershoot) * 100));
}

/**
 * Count headings in HTML content.
 *
 * @param html - The full HTML string.
 * @returns Number of heading tags found.
 */
function countHeadings(html: string): number {
  const matches = html.match(HEADING_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Extract word counts from each <p> element in the HTML.
 *
 * @param html - The full HTML string.
 * @returns Array of word counts, one per paragraph.
 */
function extractParagraphWordCounts(html: string): number[] {
  const counts: number[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  PARAGRAPH_REGEX.lastIndex = 0;

  while ((match = PARAGRAPH_REGEX.exec(html)) !== null) {
    const innerText = match[1].replace(STRIP_HTML, ' ').trim();
    const words = innerText.split(/\s+/).filter((w) => w.length > 0);
    if (words.length > 0) {
      counts.push(words.length);
    }
  }

  return counts;
}

/**
 * Content depth plugin check.
 *
 * Evaluates whether content has sufficient depth for its declared content type
 * by examining word count, heading distribution, and paragraph structure.
 */
export const contentDepthCheck: PluginCheck = {
  name: 'content-depth',
  description:
    'Analyses content depth by evaluating word count against type-specific thresholds, heading distribution, and paragraph variety.',
  severity: 'critical',
  weight: config.weight,

  /**
   * Execute the content depth check.
   *
   * @param context - The check context containing HTML, raw content, and metadata.
   * @returns A CheckResult with the depth score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'content-depth';

    try {
      const { html, metadata } = context;
      const { wordCount, contentType } = metadata;

      // Edge case: no content at all
      if (wordCount === 0 && (!html || html.trim().length === 0)) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No content available for depth analysis.',
          details: {
            wordCount: 0,
            contentType,
            minWords: resolveMinWords(contentType),
            headings: 0,
            paragraphs: 0,
          },
          fixSuggestion: 'Add substantial content to the page before publishing.',
        };
      }

      const minWords = resolveMinWords(contentType);
      const headingCount = countHeadings(html);
      const paragraphWordCounts = extractParagraphWordCounts(html);

      const wordCountScore = scoreWordCount(wordCount, minWords);
      const headingScore = scoreHeadingDistribution(headingCount, wordCount);
      const paragraphScore = scoreParagraphVariety(paragraphWordCounts);

      // Weighted combination: word count 60%, headings 20%, paragraphs 20%
      const finalScore = Math.round(
        wordCountScore * 0.6 + headingScore * 0.2 + paragraphScore * 0.2,
      );

      const passed = finalScore >= 60;

      const avgParagraphLength =
        paragraphWordCounts.length > 0
          ? Math.round(
              paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length,
            )
          : 0;

      let message: string;
      if (finalScore >= 90) {
        message = `Content has excellent depth (${wordCount} words, ${headingCount} headings).`;
      } else if (finalScore >= 60) {
        message = `Content depth is adequate (${wordCount} words, ${headingCount} headings). Consider expanding.`;
      } else {
        message = `Content lacks sufficient depth (${wordCount}/${minWords} words). Expand content and improve structure.`;
      }

      const result: CheckResult = {
        checkName,
        score: finalScore,
        passed,
        severity: 'critical',
        message,
        details: {
          wordCount,
          minWords,
          contentType,
          headingCount,
          paragraphCount: paragraphWordCounts.length,
          avgParagraphLength,
          wordCountScore,
          headingScore,
          paragraphScore,
        },
      };

      if (!passed) {
        const suggestions: string[] = [];
        if (wordCountScore < 80) {
          suggestions.push(
            `Increase content to at least ${minWords} words (currently ${wordCount}).`,
          );
        }
        if (headingScore < 80) {
          suggestions.push(
            `Add more headings — aim for at least one heading every ${MAX_WORDS_PER_HEADING_SECTION} words.`,
          );
        }
        if (paragraphScore < 80) {
          suggestions.push(
            `Adjust paragraph lengths to average ${IDEAL_PARAGRAPH_MIN}-${IDEAL_PARAGRAPH_MAX} words (currently ~${avgParagraphLength}).`,
          );
        }
        result.fixSuggestion = suggestions.join(' ');
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during content depth analysis';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Content depth check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the page has valid HTML structure.',
      };
    }
  },
};
