/**
 * @module seo-auditor/checks/title-tag
 * @description Validates the HTML &lt;title&gt; tag for SEO compliance.
 * Checks presence, length, keyword relevance, and uniqueness.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.titleTag;

/**
 * Set of generic/placeholder titles that provide no SEO value.
 * Comparison is performed case-insensitively.
 */
const GENERIC_TITLES: ReadonlySet<string> = new Set([
  'home',
  'untitled',
  'welcome',
  'page',
  'new page',
  'homepage',
  'index',
  'test',
  'document',
  'my site',
  'website',
  'default',
  'no title',
]);

/**
 * Extracts the content of the first &lt;title&gt; tag from raw HTML.
 *
 * @param html - The full HTML source string.
 * @returns The trimmed title text, or `null` if no title tag is found.
 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }
  const text = match[1].replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

/**
 * Determines whether the title contains at least one keyword from the page tags.
 *
 * @param title - The extracted title string.
 * @param tags - Array of keyword tags from page metadata.
 * @returns `true` if at least one tag appears in the title (case-insensitive).
 */
function containsKeyword(title: string, tags: readonly string[]): boolean {
  const lowerTitle = title.toLowerCase();
  return tags.some((tag) => {
    const lowerTag = tag.toLowerCase().trim();
    return lowerTag.length > 0 && lowerTitle.includes(lowerTag);
  });
}

/**
 * Checks whether the title offers a unique differentiator beyond just repeating
 * the site name.
 *
 * @param title - The extracted title string.
 * @param siteName - The site name from configuration.
 * @returns `true` if the title contains meaningful content beyond the site name.
 */
function isUnique(title: string, siteName: string): boolean {
  if (!siteName || siteName.trim().length === 0) {
    return title.trim().length > 0;
  }
  const stripped = title
    .replace(new RegExp(siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/[\s\-|:–—]+/g, ' ')
    .trim();
  return stripped.length >= 5;
}

/**
 * PluginCheck that validates the page's &lt;title&gt; tag for SEO compliance.
 *
 * Scoring breakdown (each component 0–25, totalling 0–100):
 * - **Presence (25%)**: Title tag exists and is non-empty.
 * - **Length (25%)**: Title length falls within the configured min/max bounds.
 * - **Keyword present (25%)**: Title contains at least one page keyword/tag.
 * - **Unique differentiator (25%)**: Title has meaningful content beyond the site name.
 *
 * @see seoAuditorConfig.checks.titleTag
 */
export const titleTagCheck: PluginCheck = {
  name: 'title-tag',
  description:
    'Validates the <title> tag for presence, optimal length, keyword inclusion, and unique differentiation.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata, siteConfig } = context;
      const title = extractTitle(html);
      const issues: string[] = [];

      /* ---------- Presence (25 pts) ---------- */
      let presenceScore = 0;
      if (title !== null) {
        if (GENERIC_TITLES.has(title.toLowerCase())) {
          presenceScore = 5;
          issues.push(`Title "${title}" is generic and should be descriptive.`);
        } else {
          presenceScore = 25;
        }
      } else {
        issues.push('No <title> tag found in the HTML.');
      }

      /* ---------- Length (25 pts) ---------- */
      let lengthScore = 0;
      if (title !== null) {
        const len = title.length;
        if (len >= CONFIG.minLength && len <= CONFIG.maxLength) {
          lengthScore = 25;
        } else if (len < CONFIG.minLength) {
          lengthScore = Math.round((len / CONFIG.minLength) * 25);
          issues.push(
            `Title is ${len} chars; minimum recommended is ${CONFIG.minLength}.`,
          );
        } else {
          // len > CONFIG.maxLength
          const overshoot = len - CONFIG.maxLength;
          lengthScore = Math.max(0, 25 - Math.round((overshoot / CONFIG.maxLength) * 25));
          issues.push(
            `Title is ${len} chars; maximum recommended is ${CONFIG.maxLength}.`,
          );
        }
      }

      /* ---------- Keyword present (25 pts) ---------- */
      let keywordScore = 0;
      if (title !== null) {
        const tags = metadata.tags ?? [];
        if (tags.length === 0) {
          // No tags to compare against — grant partial credit.
          keywordScore = 15;
          issues.push('No tags available in metadata to verify keyword presence.');
        } else if (containsKeyword(title, tags)) {
          keywordScore = 25;
        } else {
          issues.push('Title does not contain any of the page keyword tags.');
        }
      }

      /* ---------- Unique differentiator (25 pts) ---------- */
      let uniqueScore = 0;
      if (title !== null) {
        if (isUnique(title, siteConfig.siteName)) {
          uniqueScore = 25;
        } else {
          issues.push(
            'Title appears to be just the site name without unique page-level content.',
          );
        }
      }

      const totalScore = presenceScore + lengthScore + keywordScore + uniqueScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'title-tag',
        score: totalScore,
        passed,
        severity: 'critical',
        message:
          issues.length === 0
            ? 'Title tag passes all SEO checks.'
            : issues.join(' '),
        details: {
          extractedTitle: title,
          presenceScore,
          lengthScore,
          keywordScore,
          uniqueScore,
          titleLength: title?.length ?? 0,
        },
        fixSuggestion:
          totalScore < 100
            ? `Ensure the <title> is ${CONFIG.minLength}–${CONFIG.maxLength} characters, includes a target keyword, and differentiates from the site name.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'title-tag',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Title tag check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the title tag check encountered an internal error.',
      };
    }
  },
};
