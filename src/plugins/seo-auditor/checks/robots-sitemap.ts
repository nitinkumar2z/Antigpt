/**
 * @module seo-auditor/checks/robots-sitemap
 * @description Validates robots meta tag and sitemap reference coherence.
 * Ensures the page is indexable and references a sitemap.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.robotsSitemap;

/**
 * Extracts the content of the &lt;meta name="robots"&gt; tag.
 *
 * @param html - Full HTML source string.
 * @returns The trimmed robots content string, or `null` if not found.
 */
function extractRobotsContent(html: string): string | null {
  const match = html.match(
    /<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
  );
  if (match) {
    return match[1].trim().toLowerCase();
  }
  const altMatch = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']robots["'][^>]*\/?>/i,
  );
  if (altMatch) {
    return altMatch[1].trim().toLowerCase();
  }
  return null;
}

/**
 * Checks whether a robots content string contains a "noindex" directive.
 *
 * @param robotsContent - The robots meta tag content (lowercased).
 * @returns `true` if the page is marked noindex.
 */
function isNoindex(robotsContent: string): boolean {
  const directives = robotsContent.split(/[\s,]+/);
  return directives.some((d) => d === 'noindex' || d === 'none');
}

/**
 * Checks whether the HTML contains a reference to a sitemap.
 * Looks for sitemap links, sitemap.xml mentions, or structured references.
 *
 * @param html - Full HTML source string.
 * @returns `true` if a sitemap reference is found.
 */
function hasSitemapReference(html: string): boolean {
  // Check for <link> to sitemap.
  if (/<link\s+[^>]*rel\s*=\s*["']sitemap["'][^>]*>/i.test(html)) {
    return true;
  }
  // Check for href containing sitemap.xml.
  if (/href\s*=\s*["'][^"']*sitemap\.xml[^"']*["']/i.test(html)) {
    return true;
  }
  // Check for inline reference to sitemap.
  if (/sitemap\.xml/i.test(html)) {
    return true;
  }
  return false;
}

/**
 * PluginCheck that validates robots meta tag and sitemap reference coherence.
 *
 * Scoring breakdown:
 * - **Robots present (40%)**: A &lt;meta name="robots"&gt; tag exists.
 * - **Not noindex (40%)**: The page is not accidentally set to noindex.
 * - **Sitemap reference (20%)**: The page references a sitemap.
 *
 * @see seoAuditorConfig.checks.robotsSitemap
 */
export const robotsSitemapCheck: PluginCheck = {
  name: 'robots-sitemap',
  description:
    'Validates robots meta tag presence, indexability, and sitemap reference coherence.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const robotsContent = extractRobotsContent(html);
      const issues: string[] = [];

      /* ---------- Robots present (40 pts) ---------- */
      let robotsScore = 0;
      if (robotsContent !== null) {
        robotsScore = 40;
      } else {
        // No robots tag is acceptable — browsers default to index,follow.
        // Give partial credit since explicit is better.
        robotsScore = 20;
        issues.push(
          'No <meta name="robots"> tag found. Consider adding one explicitly (e.g. "index, follow").',
        );
      }

      /* ---------- Not noindex (40 pts) ---------- */
      let noindexScore = 0;
      if (robotsContent !== null) {
        if (!isNoindex(robotsContent)) {
          noindexScore = 40;
        } else {
          issues.push(
            `Page is marked as noindex ("${robotsContent}"). This prevents search engine indexing.`,
          );
        }
      } else {
        // No robots tag — page is indexable by default.
        noindexScore = 40;
      }

      /* ---------- Sitemap reference (20 pts) ---------- */
      let sitemapScore = 0;
      if (hasSitemapReference(html)) {
        sitemapScore = 20;
      } else {
        issues.push(
          'No sitemap reference found in the page. Consider linking to sitemap.xml.',
        );
      }

      const totalScore = robotsScore + noindexScore + sitemapScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'robots-sitemap',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Robots and sitemap configuration passes all checks.'
            : issues.join(' '),
        details: {
          robotsContent,
          isNoindex: robotsContent !== null ? isNoindex(robotsContent) : false,
          hasSitemap: hasSitemapReference(html),
          robotsScore,
          noindexScore,
          sitemapScore,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Add <meta name="robots" content="index, follow"> and include a link to sitemap.xml.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'robots-sitemap',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Robots/sitemap check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the robots/sitemap check encountered an internal error.',
      };
    }
  },
};
