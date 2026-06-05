/**
 * @module seo-auditor/checks/hreflang
 * @description Validates hreflang link tags for multilingual SEO compliance.
 * Checks language completeness, x-default presence, and absolute URL usage.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.hreflang;

/**
 * Represents a single hreflang link tag extracted from HTML.
 */
interface HreflangEntry {
  /** The hreflang attribute value (e.g. 'en', 'fr', 'x-default'). */
  lang: string;
  /** The href attribute value. */
  href: string;
}

/**
 * Extracts all &lt;link rel="alternate" hreflang="..."&gt; tags from HTML.
 *
 * @param html - Full HTML source string.
 * @returns Array of hreflang entries.
 */
function extractHreflangTags(html: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  // Match <link rel="alternate" hreflang="..." href="...">
  const regex = /<link\s+[^>]*rel\s*=\s*["']alternate["'][^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    entries.push({ lang: match[1].trim().toLowerCase(), href: match[2].trim() });
  }

  // Also handle reversed attribute order: hreflang before rel, href before hreflang, etc.
  const altRegex = /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']alternate["'][^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = altRegex.exec(html)) !== null) {
    const lang = match[2].trim().toLowerCase();
    const href = match[1].trim();
    // Avoid duplicates.
    if (!entries.some((e) => e.lang === lang && e.href === href)) {
      entries.push({ lang, href });
    }
  }

  const altRegex2 = /<link\s+[^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']alternate["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = altRegex2.exec(html)) !== null) {
    const lang = match[1].trim().toLowerCase();
    const href = match[2].trim();
    if (!entries.some((e) => e.lang === lang && e.href === href)) {
      entries.push({ lang, href });
    }
  }

  return entries;
}

/**
 * Determines whether a URL string is an absolute URL.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL starts with http:// or https://.
 */
function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * PluginCheck that validates hreflang tags for multilingual SEO compliance.
 *
 * For monolingual sites (supportedLanguages.length ≤ 1), the check scores 100
 * (not applicable). For multilingual sites:
 *
 * Scoring breakdown:
 * - **Completeness (40%)**: All supported languages have hreflang tags.
 * - **x-default (30%)**: An x-default hreflang tag is present.
 * - **Valid URLs (30%)**: All hreflang hrefs are absolute URLs.
 *
 * @see seoAuditorConfig.checks.hreflang
 */
export const hreflangCheck: PluginCheck = {
  name: 'hreflang',
  description:
    'Validates hreflang tags for multilingual sites: language completeness, x-default, and absolute URLs.',
  severity: 'info',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, siteConfig } = context;
      const supportedLanguages = siteConfig.supportedLanguages;

      // Monolingual site — hreflang not applicable.
      if (supportedLanguages.length <= 1) {
        return {
          checkName: 'hreflang',
          score: 100,
          passed: true,
          severity: 'info',
          message: 'Monolingual site — hreflang tags are not required.',
          details: {
            isMultilingual: false,
            supportedLanguages,
          },
        };
      }

      const entries = extractHreflangTags(html);
      const issues: string[] = [];
      const foundLangs = new Set(entries.map((e) => e.lang));

      /* ---------- Completeness (40 pts) ---------- */
      let completenessScore = 0;
      const normalizedSupported = supportedLanguages.map((l) => l.toLowerCase());
      const coveredLangs = normalizedSupported.filter((l) => foundLangs.has(l));
      const missingLangs = normalizedSupported.filter((l) => !foundLangs.has(l));

      if (missingLangs.length === 0) {
        completenessScore = 40;
      } else {
        const ratio = coveredLangs.length / normalizedSupported.length;
        completenessScore = Math.round(ratio * 40);
        issues.push(
          `Missing hreflang tags for languages: ${missingLangs.join(', ')}.`,
        );
      }

      /* ---------- x-default (30 pts) ---------- */
      let xDefaultScore = 0;
      if (foundLangs.has('x-default')) {
        xDefaultScore = 30;
      } else if (entries.length > 0) {
        issues.push('Missing hreflang="x-default" tag for language fallback.');
      } else {
        issues.push('No hreflang tags found at all. Multilingual sites need hreflang annotations.');
      }

      /* ---------- Valid URLs (30 pts) ---------- */
      let validUrlScore = 0;
      if (entries.length > 0) {
        const absoluteEntries = entries.filter((e) => isAbsoluteUrl(e.href));
        const ratio = absoluteEntries.length / entries.length;
        validUrlScore = Math.round(ratio * 30);
        const relativeCount = entries.length - absoluteEntries.length;
        if (relativeCount > 0) {
          issues.push(
            `${relativeCount} hreflang href(s) are not absolute URLs. Use fully-qualified URLs.`,
          );
        }
      }

      const totalScore = completenessScore + xDefaultScore + validUrlScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'hreflang',
        score: totalScore,
        passed,
        severity: 'info',
        message:
          issues.length === 0
            ? 'Hreflang tags pass all checks.'
            : issues.join(' '),
        details: {
          isMultilingual: true,
          supportedLanguages,
          foundLanguages: Array.from(foundLangs),
          missingLanguages: missingLangs,
          hreflangCount: entries.length,
          hasXDefault: foundLangs.has('x-default'),
          completenessScore,
          xDefaultScore,
          validUrlScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Add <link rel="alternate" hreflang="..."> tags for all supported languages (${supportedLanguages.join(', ')}) plus x-default, using absolute URLs.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'hreflang',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Hreflang check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the hreflang check encountered an internal error.',
      };
    }
  },
};
