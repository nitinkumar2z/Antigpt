/**
 * @module seo-auditor/checks/heading-hierarchy
 * @description Validates the HTML heading structure (h1–h6) for SEO compliance.
 * Ensures a single h1, no level skips, proper h1 length, and use of subheadings.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.headingHierarchy;

/** Maximum allowed character length for the h1 tag content. */
const MAX_H1_LENGTH = 70;

/**
 * Represents a single heading extracted from HTML.
 */
interface HeadingEntry {
  /** Heading level (1–6). */
  level: number;
  /** Trimmed text content of the heading. */
  text: string;
}

/**
 * Extracts all heading tags (h1–h6) from raw HTML, in document order.
 *
 * @param html - Full HTML source string.
 * @returns Array of heading entries with their level and text content.
 */
function extractHeadings(html: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const regex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    // Strip inner HTML tags to get plain text.
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    headings.push({ level, text });
  }

  return headings;
}

/**
 * Checks whether the heading sequence has any level skips.
 * A level skip occurs when a heading jumps more than one level deeper
 * (e.g. h1 → h3 with no h2 in between).
 *
 * @param headings - Ordered array of heading entries.
 * @returns Array of human-readable skip descriptions.
 */
function findLevelSkips(headings: HeadingEntry[]): string[] {
  const skips: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      skips.push(`h${prev} → h${curr} (skipped h${prev + 1})`);
    }
  }
  return skips;
}

/**
 * PluginCheck that validates the page's heading hierarchy for SEO compliance.
 *
 * Scoring breakdown:
 * - **Single h1 (40%)**: Exactly one h1 tag exists.
 * - **No level skips (30%)**: Headings do not skip levels.
 * - **h1 length (15%)**: The h1 tag is ≤ 70 characters.
 * - **Has subheadings (15%)**: At least one h2+ heading exists.
 *
 * @see seoAuditorConfig.checks.headingHierarchy
 */
export const headingHierarchyCheck: PluginCheck = {
  name: 'heading-hierarchy',
  description:
    'Validates heading structure: single h1, no level skips, appropriate h1 length, and presence of subheadings.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const headings = extractHeadings(html);
      const issues: string[] = [];

      /* ---------- Single h1 (40 pts) ---------- */
      let singleH1Score = 0;
      const h1s = headings.filter((h) => h.level === 1);
      if (h1s.length === 1) {
        singleH1Score = 40;
      } else if (h1s.length === 0) {
        issues.push('No h1 tag found. Every page should have exactly one h1.');
      } else {
        singleH1Score = 10;
        issues.push(
          `Found ${h1s.length} h1 tags; there should be exactly one. Texts: ${h1s.map((h) => `"${h.text}"`).join(', ')}.`,
        );
      }

      /* ---------- No level skips (30 pts) ---------- */
      let noSkipScore = 0;
      if (headings.length > 0) {
        const skips = findLevelSkips(headings);
        if (skips.length === 0) {
          noSkipScore = 30;
        } else {
          // Deduct proportionally but keep a minimum of 0.
          const deductionPerSkip = Math.round(30 / Math.max(skips.length, 1));
          noSkipScore = Math.max(0, 30 - deductionPerSkip * skips.length);
          issues.push(`Heading level skips detected: ${skips.join('; ')}.`);
        }
      } else {
        // No headings at all — partial credit since there's nothing to skip.
        noSkipScore = 15;
        issues.push('No headings found in the page.');
      }

      /* ---------- h1 length (15 pts) ---------- */
      let h1LengthScore = 0;
      if (h1s.length >= 1) {
        const h1Text = h1s[0].text;
        if (h1Text.length <= MAX_H1_LENGTH) {
          h1LengthScore = 15;
        } else {
          const overshoot = h1Text.length - MAX_H1_LENGTH;
          h1LengthScore = Math.max(0, 15 - Math.round((overshoot / MAX_H1_LENGTH) * 15));
          issues.push(
            `h1 is ${h1Text.length} chars; recommended maximum is ${MAX_H1_LENGTH}.`,
          );
        }
      }

      /* ---------- Has subheadings (15 pts) ---------- */
      let subheadingScore = 0;
      const subheadings = headings.filter((h) => h.level >= 2);
      if (subheadings.length >= 2) {
        subheadingScore = 15;
      } else if (subheadings.length === 1) {
        subheadingScore = 10;
        issues.push('Only one subheading found; consider adding more for structure.');
      } else {
        issues.push('No subheadings (h2–h6) found; add subheadings to improve structure.');
      }

      const totalScore = singleH1Score + noSkipScore + h1LengthScore + subheadingScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'heading-hierarchy',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Heading hierarchy passes all SEO checks.'
            : issues.join(' '),
        details: {
          totalHeadings: headings.length,
          h1Count: h1s.length,
          subheadingCount: subheadings.length,
          h1Texts: h1s.map((h) => h.text),
          singleH1Score,
          noSkipScore,
          h1LengthScore,
          subheadingScore,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Ensure exactly one h1 (≤70 chars), use h2–h6 subheadings, and avoid skipping heading levels.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'heading-hierarchy',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Heading hierarchy check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the heading hierarchy check encountered an internal error.',
      };
    }
  },
};
