/**
 * @module seo-auditor/checks/social-meta
 * @description Validates Open Graph and Twitter Card meta tags for social sharing compliance.
 * Checks completeness of both OG and Twitter Card tag sets.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.socialMeta;

/** Required Open Graph meta properties. */
const OG_REQUIRED_PROPERTIES: readonly string[] = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
];

/** Required Twitter Card meta properties. */
const TWITTER_REQUIRED_PROPERTIES: readonly string[] = [
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
];

/**
 * Extracts all meta property/name values from the HTML.
 * Handles both `property="og:..."` and `name="twitter:..."` patterns.
 *
 * @param html - Full HTML source string.
 * @returns A map of meta property/name to its content value.
 */
function extractMetaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();

  // Match property-based meta tags (Open Graph).
  const propertyRegex = /<meta\s+[^>]*property\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = propertyRegex.exec(html)) !== null) {
    tags.set(match[1].toLowerCase().trim(), match[2].trim());
  }

  // Reversed order: content before property.
  const propertyRegexAlt = /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = propertyRegexAlt.exec(html)) !== null) {
    const key = match[2].toLowerCase().trim();
    if (!tags.has(key)) {
      tags.set(key, match[1].trim());
    }
  }

  // Match name-based meta tags (Twitter Card).
  const nameRegex = /<meta\s+[^>]*name\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
  while ((match = nameRegex.exec(html)) !== null) {
    const key = match[1].toLowerCase().trim();
    if (!tags.has(key)) {
      tags.set(key, match[2].trim());
    }
  }

  // Reversed: content before name.
  const nameRegexAlt = /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = nameRegexAlt.exec(html)) !== null) {
    const key = match[2].toLowerCase().trim();
    if (!tags.has(key)) {
      tags.set(key, match[1].trim());
    }
  }

  return tags;
}

/**
 * Checks a set of required properties against the extracted meta tags.
 *
 * @param metaTags - Map of extracted meta tag name/property to value.
 * @param requiredProps - Array of required property names to check.
 * @returns Object containing found properties, missing properties, and ratio.
 */
function checkPropertySet(
  metaTags: Map<string, string>,
  requiredProps: readonly string[],
): { found: string[]; missing: string[]; ratio: number } {
  const found: string[] = [];
  const missing: string[] = [];

  for (const prop of requiredProps) {
    const value = metaTags.get(prop.toLowerCase());
    if (value !== undefined && value.length > 0) {
      found.push(prop);
    } else {
      missing.push(prop);
    }
  }

  const ratio = requiredProps.length > 0 ? found.length / requiredProps.length : 1;
  return { found, missing, ratio };
}

/**
 * PluginCheck that validates social meta tags (Open Graph + Twitter Card).
 *
 * Scoring breakdown:
 * - **OG complete (50%)**: All required Open Graph tags are present and non-empty.
 * - **Twitter complete (50%)**: All required Twitter Card tags are present and non-empty.
 *
 * @see seoAuditorConfig.checks.socialMeta
 */
export const socialMetaCheck: PluginCheck = {
  name: 'social-meta',
  description:
    'Validates Open Graph and Twitter Card meta tag completeness for optimal social sharing.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const metaTags = extractMetaTags(html);
      const issues: string[] = [];

      /* ---------- OG complete (50 pts) ---------- */
      const ogResult = checkPropertySet(metaTags, OG_REQUIRED_PROPERTIES);
      const ogScore = Math.round(ogResult.ratio * 50);
      if (ogResult.missing.length > 0) {
        issues.push(`Missing Open Graph tags: ${ogResult.missing.join(', ')}.`);
      }

      /* ---------- Twitter complete (50 pts) ---------- */
      const twitterResult = checkPropertySet(metaTags, TWITTER_REQUIRED_PROPERTIES);
      const twitterScore = Math.round(twitterResult.ratio * 50);
      if (twitterResult.missing.length > 0) {
        issues.push(`Missing Twitter Card tags: ${twitterResult.missing.join(', ')}.`);
      }

      const totalScore = ogScore + twitterScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'social-meta',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Social meta tags pass all checks.'
            : issues.join(' '),
        details: {
          ogFound: ogResult.found,
          ogMissing: ogResult.missing,
          ogScore,
          twitterFound: twitterResult.found,
          twitterMissing: twitterResult.missing,
          twitterScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Add the missing Open Graph (${ogResult.missing.join(', ')}) and Twitter Card (${twitterResult.missing.join(', ')}) meta tags.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'social-meta',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Social meta check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the social meta check encountered an internal error.',
      };
    }
  },
};
