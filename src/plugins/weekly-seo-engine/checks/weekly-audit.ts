/**
 * @module weekly-seo-engine/checks/weekly-audit
 * @description Performs weekly audit readiness checks across four dimensions:
 * content freshness, technical debt, SEO regression signals, and index health.
 *
 * Scoring breakdown (each component contributes to a 0–100 total):
 * - **Content freshness (30%)**: flags pages older than 90 days since last update.
 * - **Technical debt (25%)**: detects broken internal link patterns and orphan page indicators.
 * - **SEO regression (25%)**: catches missing meta tags and heading hierarchy violations.
 * - **Index health (20%)**: validates canonical, noindex absence, and sitemap references.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { weeklySeoEngineConfig } from '../config.js';

const CONFIG = weeklySeoEngineConfig.checks.weeklyAudit;

/** Maximum content age in days before it is considered stale. */
const MAX_AGE_DAYS = 90;

/** Number of milliseconds in a single day. */
const MS_PER_DAY = 86_400_000;

/**
 * Regex matching `href` values pointing to non-standard internal paths.
 *
 * Flags hrefs containing double slashes in the path segment, file extensions
 * typically absent from clean URL schemes, or naked fragments that suggest
 * placeholder links.
 */
const BROKEN_INTERNAL_LINK_PATTERN =
  /href=["'](?!https?:\/\/|mailto:|tel:)([^"']*(?:\/\/[^"']+|\.(?:htm|php|asp)[^"']*))["']/gi;

/**
 * Regex detecting orphan-page indicators: pages with zero outbound internal links
 * are suggested by the absence of any `<a>` tag with an `href` starting with `/`.
 */
const INTERNAL_ANCHOR_PATTERN = /<a\s[^>]*href=["']\/[^"']*["'][^>]*>/gi;

/**
 * Essential meta tags that should be present on every auditable page.
 */
const REQUIRED_META_NAMES: readonly string[] = [
  'description',
  'viewport',
  'robots',
];

/**
 * Regex matching the content of a `robots` meta tag that includes `noindex`.
 */
const NOINDEX_PATTERN = /\bnoindex\b/i;

/**
 * Computes the content-freshness component score (0–30).
 *
 * @param updatedAt - ISO 8601 timestamp of the last content update, or undefined.
 * @param issues - Mutable array to collect human-readable issue descriptions.
 * @returns Numeric score between 0 and 30.
 */
function scoreContentFreshness(updatedAt: string | undefined, issues: string[]): number {
  if (!updatedAt) {
    issues.push('No updatedAt timestamp in metadata; freshness cannot be verified.');
    return 10; // Partial credit — absence is not necessarily critical.
  }

  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) {
    issues.push(`Invalid updatedAt timestamp: "${updatedAt}".`);
    return 5;
  }

  const ageDays = Math.floor((Date.now() - updatedDate.getTime()) / MS_PER_DAY);
  if (ageDays <= MAX_AGE_DAYS) {
    return 30;
  }

  // Degrade linearly from 30 → 0 over the range 90–360 days.
  const overage = ageDays - MAX_AGE_DAYS;
  const degraded = Math.max(0, 30 - Math.round((overage / 270) * 30));
  issues.push(
    `Content is ${ageDays} days old (last updated ${updatedAt}); maximum recommended age is ${MAX_AGE_DAYS} days.`,
  );
  return degraded;
}

/**
 * Computes the technical-debt component score (0–25).
 *
 * @param html - Raw HTML of the page.
 * @param issues - Mutable array to collect human-readable issue descriptions.
 * @returns Numeric score between 0 and 25.
 */
function scoreTechnicalDebt(html: string, issues: string[]): number {
  let score = 25;

  // Broken internal link patterns
  const brokenLinks = html.match(BROKEN_INTERNAL_LINK_PATTERN);
  if (brokenLinks && brokenLinks.length > 0) {
    const penalty = Math.min(15, brokenLinks.length * 5);
    score -= penalty;
    issues.push(
      `Found ${brokenLinks.length} internal link(s) with non-standard path patterns.`,
    );
  }

  // Orphan page indicator: no outbound internal links at all
  const internalAnchors = html.match(INTERNAL_ANCHOR_PATTERN);
  if (!internalAnchors || internalAnchors.length === 0) {
    score -= 10;
    issues.push('Page has no outbound internal links — potential orphan page.');
  }

  return Math.max(0, score);
}

/**
 * Computes the SEO-regression component score (0–25).
 *
 * @param html - Raw HTML of the page.
 * @param issues - Mutable array to collect human-readable issue descriptions.
 * @returns Numeric score between 0 and 25.
 */
function scoreSeoRegression(html: string, issues: string[]): number {
  let score = 25;

  // Missing required meta tags
  for (const name of REQUIRED_META_NAMES) {
    const metaPattern = new RegExp(
      `<meta\\s[^>]*name=["']${name}["'][^>]*/?>`,
      'i',
    );
    if (!metaPattern.test(html)) {
      score -= 5;
      issues.push(`Missing required <meta name="${name}"> tag.`);
    }
  }

  // Heading hierarchy violations: h1 should exist and appear before h2
  const h1Match = html.match(/<h1[\s>]/i);
  const h2Match = html.match(/<h2[\s>]/i);
  if (!h1Match) {
    score -= 5;
    issues.push('No <h1> tag found — heading hierarchy is broken.');
  } else if (h2Match) {
    const h1Index = html.search(/<h1[\s>]/i);
    const h2Index = html.search(/<h2[\s>]/i);
    if (h2Index < h1Index) {
      score -= 3;
      issues.push('<h2> appears before <h1> — heading hierarchy violation.');
    }
  }

  // Check for skipped heading levels (e.g. h1 → h3 without h2)
  const headingLevels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) =>
    parseInt(m[1], 10),
  );
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      score -= 2;
      issues.push(
        `Heading level jump from h${headingLevels[i - 1]} to h${headingLevels[i]}.`,
      );
      break; // Only penalise once for hierarchy gaps.
    }
  }

  return Math.max(0, score);
}

/**
 * Computes the index-health component score (0–20).
 *
 * @param html - Raw HTML of the page.
 * @param url - Fully-qualified page URL for canonical validation.
 * @param issues - Mutable array to collect human-readable issue descriptions.
 * @returns Numeric score between 0 and 20.
 */
function scoreIndexHealth(html: string, url: string, issues: string[]): number {
  let score = 20;

  // Canonical tag presence and correctness
  const canonicalMatch = html.match(/<link\s[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)
    ?? html.match(/<link\s[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i);

  if (!canonicalMatch) {
    score -= 8;
    issues.push('No canonical link tag found.');
  } else {
    const canonicalUrl = canonicalMatch[1];
    // Warn if canonical points to a completely different domain
    try {
      const pageDomain = new URL(url).hostname;
      const canonDomain = new URL(canonicalUrl, url).hostname;
      if (pageDomain !== canonDomain) {
        score -= 5;
        issues.push(
          `Canonical URL points to a different domain: "${canonicalUrl}".`,
        );
      }
    } catch {
      // URL parsing failure — deduct a small amount.
      score -= 2;
      issues.push(`Unable to parse canonical URL: "${canonicalUrl}".`);
    }
  }

  // Accidental noindex
  const robotsMeta = html.match(
    /<meta\s[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i,
  );
  if (robotsMeta && NOINDEX_PATTERN.test(robotsMeta[1])) {
    score -= 7;
    issues.push('Page has a noindex directive — it will not be indexed.');
  }

  // Sitemap reference: look for a sitemap link in the HTML or an XML sitemap mention
  const hasSitemapRef =
    /<link\s[^>]*rel=["']sitemap["'][^>]*\/?>/i.test(html) ||
    /sitemap\.xml/i.test(html);
  if (!hasSitemapRef) {
    score -= 5;
    issues.push('No sitemap reference found in the page.');
  }

  return Math.max(0, score);
}

/**
 * Weekly audit readiness check.
 *
 * Evaluates four dimensions to determine whether a page is ready for
 * a weekly SEO audit cycle:
 *
 * | Component          | Max Points | Weight |
 * |--------------------|------------|--------|
 * | Content freshness  |     30     |  30%   |
 * | Technical debt     |     25     |  25%   |
 * | SEO regression     |     25     |  25%   |
 * | Index health       |     20     |  20%   |
 *
 * @see weeklySeoEngineConfig.checks.weeklyAudit
 */
export const weeklyAuditCheck: PluginCheck = {
  name: 'weekly-audit',
  description:
    'Performs weekly audit readiness checks across content freshness, technical debt, SEO regression signals, and index health.',
  severity: 'warning',
  weight: CONFIG.weight,

  /**
   * Executes the weekly audit check against the supplied context.
   *
   * @param context - The page / site context to evaluate.
   * @returns A promise resolving to the structured check result. Never throws.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata, url } = context;
      const issues: string[] = [];

      const freshnessScore = scoreContentFreshness(metadata.updatedAt, issues);
      const techDebtScore = scoreTechnicalDebt(html, issues);
      const regressionScore = scoreSeoRegression(html, issues);
      const indexHealthScore = scoreIndexHealth(html, url, issues);

      const totalScore = freshnessScore + techDebtScore + regressionScore + indexHealthScore;
      const passed = totalScore >= weeklySeoEngineConfig.threshold;

      return {
        checkName: 'weekly-audit',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Weekly audit readiness checks passed on all dimensions.'
            : issues.join(' '),
        details: {
          freshnessScore,
          techDebtScore,
          regressionScore,
          indexHealthScore,
          contentAgeDays: metadata.updatedAt
            ? Math.floor(
                (Date.now() - new Date(metadata.updatedAt).getTime()) / MS_PER_DAY,
              )
            : null,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Review stale content for updates, fix broken internal links, restore missing meta tags, and verify canonical/noindex settings.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'weekly-audit',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Weekly audit check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the page HTML and metadata — the weekly audit check encountered an internal error.',
      };
    }
  },
};
