/**
 * @module seo-auditor/checks/meta-description
 * @description Validates the HTML meta description tag for SEO compliance.
 * Checks presence, length, content quality, and call-to-action inclusion.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.metaDescription;

/**
 * Words that indicate a call-to-action in the meta description.
 * Checked case-insensitively as whole words via word-boundary regex.
 */
const CTA_WORDS: readonly string[] = [
  'learn',
  'discover',
  'find',
  'get',
  'explore',
  'read',
  'see',
  'try',
  'start',
  'join',
  'compare',
  'check',
  'browse',
  'download',
  'sign up',
  'subscribe',
  'unlock',
  'boost',
  'grow',
  'build',
  'create',
  'master',
  'understand',
  'improve',
];

/**
 * Extracts the content attribute of the first &lt;meta name="description"&gt; tag.
 *
 * @param html - Full HTML source string.
 * @returns The trimmed description text, or `null` if not found.
 */
function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i,
  );
  if (match) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : null;
  }
  // Also handle reversed attribute order: content before name.
  const altMatch = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  );
  if (altMatch) {
    const text = altMatch[1].replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : null;
  }
  return null;
}

/**
 * Checks whether the description is merely a truncated copy of the raw page content.
 * A description is considered truncated if the page's raw content starts with it
 * (with some tolerance for whitespace differences).
 *
 * @param description - The meta description text.
 * @param rawContent - The raw page content.
 * @returns `true` if the description appears to be an original composition.
 */
function isOriginalDescription(description: string, rawContent: string): boolean {
  const normDesc = description.toLowerCase().replace(/\s+/g, ' ').trim();
  const normContent = rawContent.toLowerCase().replace(/\s+/g, ' ').trim();

  if (normDesc.length === 0 || normContent.length === 0) {
    return true;
  }

  // Check if the description is a substring of the first 500 chars of content.
  const contentPrefix = normContent.slice(0, 500);
  if (contentPrefix.includes(normDesc)) {
    return false;
  }

  // Check for high overlap (>90% of words match sequentially).
  const descWords = normDesc.split(' ');
  const contentWords = normContent.split(' ').slice(0, descWords.length + 5);
  let matchCount = 0;
  let contentIdx = 0;
  for (const word of descWords) {
    while (contentIdx < contentWords.length) {
      if (contentWords[contentIdx] === word) {
        matchCount++;
        contentIdx++;
        break;
      }
      contentIdx++;
    }
  }
  const overlapRatio = descWords.length > 0 ? matchCount / descWords.length : 0;
  return overlapRatio < 0.9;
}

/**
 * Checks whether the description contains a call-to-action word.
 *
 * @param description - The meta description text.
 * @returns `true` if at least one CTA word is present.
 */
function containsCta(description: string): boolean {
  const lower = description.toLowerCase();
  return CTA_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * PluginCheck that validates the page's meta description for SEO compliance.
 *
 * Scoring breakdown:
 * - **Presence (30%)**: Meta description tag exists and is non-empty.
 * - **Length (30%)**: Description length falls within 120–160 characters.
 * - **Quality (20%)**: Description is not just truncated page content.
 * - **CTA (20%)**: Description contains a call-to-action word.
 *
 * @see seoAuditorConfig.checks.metaDescription
 */
export const metaDescriptionCheck: PluginCheck = {
  name: 'meta-description',
  description:
    'Validates the meta description for presence, optimal length, originality, and call-to-action inclusion.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, rawContent } = context;
      const description = extractMetaDescription(html);
      const issues: string[] = [];

      /* ---------- Presence (30 pts) ---------- */
      let presenceScore = 0;
      if (description !== null) {
        presenceScore = 30;
      } else {
        issues.push('No <meta name="description"> tag found in the HTML.');
      }

      /* ---------- Length (30 pts) ---------- */
      let lengthScore = 0;
      if (description !== null) {
        const len = description.length;
        if (len >= CONFIG.minLength && len <= CONFIG.maxLength) {
          lengthScore = 30;
        } else if (len < CONFIG.minLength) {
          lengthScore = Math.round((len / CONFIG.minLength) * 30);
          issues.push(
            `Meta description is ${len} chars; minimum recommended is ${CONFIG.minLength}.`,
          );
        } else {
          const overshoot = len - CONFIG.maxLength;
          lengthScore = Math.max(0, 30 - Math.round((overshoot / CONFIG.maxLength) * 30));
          issues.push(
            `Meta description is ${len} chars; maximum recommended is ${CONFIG.maxLength}.`,
          );
        }
      }

      /* ---------- Quality (20 pts) ---------- */
      let qualityScore = 0;
      if (description !== null) {
        if (isOriginalDescription(description, rawContent)) {
          qualityScore = 20;
        } else {
          issues.push(
            'Meta description appears to be truncated page content instead of a crafted summary.',
          );
        }
      }

      /* ---------- CTA (20 pts) ---------- */
      let ctaScore = 0;
      if (description !== null) {
        if (containsCta(description)) {
          ctaScore = 20;
        } else {
          issues.push(
            'Meta description lacks a call-to-action word (e.g. learn, discover, explore).',
          );
        }
      }

      const totalScore = presenceScore + lengthScore + qualityScore + ctaScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'meta-description',
        score: totalScore,
        passed,
        severity: 'critical',
        message:
          issues.length === 0
            ? 'Meta description passes all SEO checks.'
            : issues.join(' '),
        details: {
          extractedDescription: description,
          descriptionLength: description?.length ?? 0,
          presenceScore,
          lengthScore,
          qualityScore,
          ctaScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Write a unique meta description of ${CONFIG.minLength}–${CONFIG.maxLength} characters that summarises the page and includes a call-to-action.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'meta-description',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Meta description check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the meta description check encountered an internal error.',
      };
    }
  },
};
