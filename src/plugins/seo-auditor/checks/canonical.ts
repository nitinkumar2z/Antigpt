/**
 * @module seo-auditor/checks/canonical
 * @description Validates the canonical URL link element for SEO compliance.
 * Checks presence, absolute URL format, self-referencing, and HTTPS usage.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.canonical;

/**
 * Extracts the href attribute from the first &lt;link rel="canonical"&gt; tag.
 *
 * @param html - Full HTML source string.
 * @returns The trimmed canonical href, or `null` if not found.
 */
function extractCanonicalHref(html: string): string | null {
  // Handle rel before href.
  const match = html.match(
    /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
  );
  if (match) {
    return match[1].trim();
  }
  // Handle href before rel.
  const altMatch = html.match(
    /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["'][^>]*\/?>/i,
  );
  if (altMatch) {
    return altMatch[1].trim();
  }
  return null;
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
 * Determines whether a URL uses the HTTPS protocol.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL starts with https://.
 */
function isHttps(url: string): boolean {
  return /^https:\/\//i.test(url);
}

/**
 * Normalises a URL for comparison by lowercasing the scheme and host,
 * removing trailing slashes, and stripping default ports.
 *
 * @param url - The URL to normalise.
 * @returns A normalised URL string suitable for equality comparison.
 */
function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Checks whether the canonical URL is self-referencing (matches the page URL).
 *
 * @param canonicalHref - The canonical link href.
 * @param pageUrl - The page's own URL.
 * @returns `true` if both URLs resolve to the same normalised form.
 */
function isSelfReferencing(canonicalHref: string, pageUrl: string): boolean {
  return normaliseUrl(canonicalHref) === normaliseUrl(pageUrl);
}

/**
 * PluginCheck that validates the page's canonical URL for SEO compliance.
 *
 * Scoring breakdown:
 * - **Presence (40%)**: A &lt;link rel="canonical"&gt; tag exists.
 * - **Absolute URL (20%)**: The canonical href is an absolute URL.
 * - **Self-referencing (20%)**: The canonical matches the page's own URL.
 * - **HTTPS (20%)**: The canonical URL uses HTTPS.
 *
 * @see seoAuditorConfig.checks.canonical
 */
export const canonicalCheck: PluginCheck = {
  name: 'canonical',
  description:
    'Validates the canonical URL for presence, absolute format, self-referencing correctness, and HTTPS usage.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, url } = context;
      const canonicalHref = extractCanonicalHref(html);
      const issues: string[] = [];

      /* ---------- Presence (40 pts) ---------- */
      let presenceScore = 0;
      if (canonicalHref !== null && canonicalHref.length > 0) {
        presenceScore = 40;
      } else {
        issues.push('No <link rel="canonical"> tag found.');
      }

      /* ---------- Absolute URL (20 pts) ---------- */
      let absoluteScore = 0;
      if (canonicalHref !== null) {
        if (isAbsoluteUrl(canonicalHref)) {
          absoluteScore = 20;
        } else {
          issues.push(
            `Canonical URL "${canonicalHref}" is not absolute. Use a fully-qualified URL.`,
          );
        }
      }

      /* ---------- Self-referencing (20 pts) ---------- */
      let selfRefScore = 0;
      if (canonicalHref !== null && isAbsoluteUrl(canonicalHref)) {
        if (isSelfReferencing(canonicalHref, url)) {
          selfRefScore = 20;
        } else {
          issues.push(
            `Canonical URL "${canonicalHref}" does not match the page URL "${url}". Ensure it is self-referencing unless intentionally consolidating.`,
          );
        }
      }

      /* ---------- HTTPS (20 pts) ---------- */
      let httpsScore = 0;
      if (canonicalHref !== null) {
        if (isHttps(canonicalHref)) {
          httpsScore = 20;
        } else if (isAbsoluteUrl(canonicalHref)) {
          issues.push('Canonical URL uses HTTP instead of HTTPS.');
        }
      }

      const totalScore = presenceScore + absoluteScore + selfRefScore + httpsScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'canonical',
        score: totalScore,
        passed,
        severity: 'critical',
        message:
          issues.length === 0
            ? 'Canonical URL passes all SEO checks.'
            : issues.join(' '),
        details: {
          canonicalHref,
          pageUrl: url,
          presenceScore,
          absoluteScore,
          selfRefScore,
          httpsScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Add a self-referencing <link rel="canonical" href="${url}"> using an absolute HTTPS URL.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'canonical',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Canonical URL check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the canonical check encountered an internal error.',
      };
    }
  },
};
