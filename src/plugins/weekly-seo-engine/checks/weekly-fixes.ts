/**
 * @fileoverview Weekly fixes check for the Weekly SEO Operations Engine.
 * @module plugins/weekly-seo-engine/checks/weekly-fixes
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { weeklySeoEngineConfig } from '../config.js';

const cfg = weeklySeoEngineConfig.checks.weeklyFixes;

/**
 * Evaluates fix-readiness for common weekly SEO issues.
 *
 * Identifies auto-fixable issues, update opportunities, markup improvements,
 * and link health problems that should be addressed weekly.
 */
export const weeklyFixesCheck: PluginCheck = {
  name: 'weekly-fixes',
  description: 'Evaluates fix-readiness for auto-fixable issues, update opportunities, markup improvements, and link health.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;

      // 1. Auto-fixable issues (30%) — images without dimensions, missing alt, empty href
      const images = html.match(/<img[^>]*>/gi) || [];
      let autoFixIssues = 0;
      for (const img of images) {
        if (!/width\s*=/i.test(img)) autoFixIssues++;
        if (!/alt\s*=\s*["'][^"']+["']/i.test(img)) autoFixIssues++;
      }
      const emptyHrefs = (html.match(/href\s*=\s*["']\s*["']/gi) || []).length;
      autoFixIssues += emptyHrefs;
      const autoFixScore = Math.max(0, 100 - autoFixIssues * 10);

      // 2. Update opportunities (25%) — outdated years, stale content
      const currentYear = new Date().getFullYear();
      const yearPattern = /\b(20[0-9]{2})\b/g;
      let outdatedYears = 0;
      let match: RegExpExecArray | null;
      while ((match = yearPattern.exec(html)) !== null) {
        const year = parseInt(match[1], 10);
        if (year < currentYear - 1 && year > 2000) outdatedYears++;
      }
      const updateScore = Math.max(0, 100 - outdatedYears * 20);

      // 3. Markup improvements (25%) — JSON-LD, OG, Twitter cards
      const hasJsonLd = /application\/ld\+json/i.test(html);
      const hasOg = /<meta[^>]*property\s*=\s*["']og:/i.test(html);
      const hasTwitter = /<meta[^>]*name\s*=\s*["']twitter:/i.test(html);
      const markupPresent = (hasJsonLd ? 1 : 0) + (hasOg ? 1 : 0) + (hasTwitter ? 1 : 0);
      const markupScore = Math.round((markupPresent / 3) * 100);

      // 4. Link health (20%) — bad href patterns
      const badLinks = (html.match(/href\s*=\s*["'](?:#|javascript:)[^"']*["']/gi) || []).length;
      const emptyAnchors = (html.match(/<a[^>]*>\s*<\/a>/gi) || []).length;
      const linkHealthScore = Math.max(0, 100 - (badLinks + emptyAnchors) * 15);

      const score = Math.round(
        autoFixScore * 0.30 + updateScore * 0.25 + markupScore * 0.25 + linkHealthScore * 0.20
      );
      const passed = score >= 50;

      return {
        checkName: 'weekly-fixes',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Weekly fixes check passed (${score}/100). Minimal issues found.`
          : `Weekly fixes needed (${score}/100). ${autoFixIssues + badLinks + emptyAnchors} issues detected.`,
        details: { autoFixScore, updateScore, markupScore, linkHealthScore, autoFixIssues, outdatedYears, badLinks },
        fixSuggestion: !passed
          ? 'Add width/height to images, update outdated year references, complete OG/Twitter card meta tags, fix empty href attributes.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'weekly-fixes',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Weekly fixes check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
