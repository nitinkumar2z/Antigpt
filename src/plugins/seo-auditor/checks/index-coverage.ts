/**
 * @module seo-auditor/checks/index-coverage
 * @description Validates index coverage signals to ensure the page is discoverable by search engines.
 * Checks canonical presence, meta tag completeness, indexability, and content substance.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.indexCoverage;

/**
 * Checks whether a canonical link tag is present in the HTML.
 *
 * @param html - Full HTML source string.
 * @returns `true` if a &lt;link rel="canonical"&gt; tag is found.
 */
function hasCanonical(html: string): boolean {
  return /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html);
}

/**
 * Checks whether the HTML has a non-empty title tag.
 *
 * @param html - Full HTML source string.
 * @returns `true` if a title tag with content is found.
 */
function hasTitle(html: string): boolean {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match !== null && match[1].trim().length > 0;
}

/**
 * Checks whether the HTML has a non-empty meta description.
 *
 * @param html - Full HTML source string.
 * @returns `true` if a meta description with content is found.
 */
function hasMetaDescription(html: string): boolean {
  const match = html.match(
    /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
  );
  if (match && match[1].trim().length > 0) {
    return true;
  }
  const altMatch = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  );
  return altMatch !== null && altMatch[1].trim().length > 0;
}

/**
 * Checks whether the page is marked as noindex.
 *
 * @param html - Full HTML source string.
 * @returns `true` if the page has a noindex directive.
 */
function isNoindex(html: string): boolean {
  const match = html.match(
    /<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
  );
  if (match) {
    const directives = match[1].toLowerCase().split(/[\s,]+/);
    return directives.some((d) => d === 'noindex' || d === 'none');
  }
  const altMatch = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']robots["'][^>]*\/?>/i,
  );
  if (altMatch) {
    const directives = altMatch[1].toLowerCase().split(/[\s,]+/);
    return directives.some((d) => d === 'noindex' || d === 'none');
  }
  return false;
}

/**
 * Determines whether the page has meaningful content beyond boilerplate.
 * Uses word count and content structure as heuristics.
 *
 * @param rawContent - The raw text content of the page.
 * @param html - Full HTML source string.
 * @returns `true` if the page appears to have substantial content.
 */
function hasMeaningfulContent(rawContent: string, html: string): boolean {
  // Check raw content word count.
  const words = rawContent.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 50) {
    return false;
  }

  // Check for content structure indicators.
  const hasParagraphs = (html.match(/<p\b[^>]*>/gi) || []).length >= 2;
  const hasHeadings = /<h[1-6]\b[^>]*>/i.test(html);

  return hasParagraphs || hasHeadings;
}

/**
 * PluginCheck that validates index coverage signals for search engine discoverability.
 *
 * Scoring breakdown:
 * - **Canonical (25%)**: A self-referencing canonical link tag is present.
 * - **Meta present (25%)**: Both title and meta description are present and non-empty.
 * - **Indexable (25%)**: The page is not marked noindex.
 * - **Has content (25%)**: The page contains meaningful content beyond boilerplate.
 *
 * @see seoAuditorConfig.checks.indexCoverage
 */
export const indexCoverageCheck: PluginCheck = {
  name: 'index-coverage',
  description:
    'Validates index coverage signals: canonical presence, meta completeness, indexability, and content substance.',
  severity: 'info',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, rawContent } = context;
      const issues: string[] = [];

      /* ---------- Canonical (25 pts) ---------- */
      let canonicalScore = 0;
      if (hasCanonical(html)) {
        canonicalScore = 25;
      } else {
        issues.push('No canonical link tag found. Add one for clear index coverage.');
      }

      /* ---------- Meta present (25 pts) ---------- */
      let metaScore = 0;
      const titlePresent = hasTitle(html);
      const descPresent = hasMetaDescription(html);
      if (titlePresent && descPresent) {
        metaScore = 25;
      } else {
        if (titlePresent) {
          metaScore = 12;
        } else if (descPresent) {
          metaScore = 12;
        }
        const missingMeta: string[] = [];
        if (!titlePresent) {
          missingMeta.push('title');
        }
        if (!descPresent) {
          missingMeta.push('meta description');
        }
        issues.push(`Missing: ${missingMeta.join(' and ')}. Both are needed for index coverage.`);
      }

      /* ---------- Indexable (25 pts) ---------- */
      let indexableScore = 0;
      if (!isNoindex(html)) {
        indexableScore = 25;
      } else {
        issues.push('Page is marked as noindex. It will not appear in search results.');
      }

      /* ---------- Has content (25 pts) ---------- */
      let contentScore = 0;
      if (hasMeaningfulContent(rawContent, html)) {
        contentScore = 25;
      } else {
        issues.push(
          'Page lacks meaningful content. Ensure at least 50 words of substantive content with proper structure.',
        );
      }

      const totalScore = canonicalScore + metaScore + indexableScore + contentScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'index-coverage',
        score: totalScore,
        passed,
        severity: 'info',
        message:
          issues.length === 0
            ? 'Index coverage signals pass all checks.'
            : issues.join(' '),
        details: {
          hasCanonical: hasCanonical(html),
          hasTitle: titlePresent,
          hasMetaDescription: descPresent,
          isNoindex: isNoindex(html),
          hasMeaningfulContent: hasMeaningfulContent(rawContent, html),
          canonicalScore,
          metaScore,
          indexableScore,
          contentScore,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Ensure the page has a canonical tag, non-empty title and meta description, is not noindex, and contains substantive content.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'index-coverage',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Index coverage check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the index coverage check encountered an internal error.',
      };
    }
  },
};
