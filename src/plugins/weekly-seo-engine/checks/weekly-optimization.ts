/**
 * @fileoverview Weekly optimization check for the Weekly SEO Operations Engine.
 * @module plugins/weekly-seo-engine/checks/weekly-optimization
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { weeklySeoEngineConfig } from '../config.js';

const cfg = weeklySeoEngineConfig.checks.weeklyOptimization;

/**
 * Evaluates weekly optimization opportunities.
 *
 * Identifies performance improvements, content optimization gaps,
 * conversion opportunities, and AEO enhancement possibilities.
 */
export const weeklyOptimizationCheck: PluginCheck = {
  name: 'weekly-optimization',
  description: 'Evaluates optimization opportunities including performance, content, conversion, and AEO enhancements.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;

      // 1. Performance (25%) — lazy loading, render-blocking resources
      const allImages = html.match(/<img[^>]*>/gi) || [];
      const lazyImages = allImages.filter((i) => /loading\s*=\s*["']lazy["']/i.test(i)).length;
      const renderBlockingScripts = (html.match(/<script(?![^>]*(?:defer|async))[^>]*src\s*=/gi) || []).length;
      let perfIssues = (allImages.length - lazyImages) + renderBlockingScripts;
      // First image doesn't need lazy (above fold)
      if (allImages.length > 0) perfIssues = Math.max(0, perfIssues - 1);
      const perfScore = Math.max(0, 100 - perfIssues * 15);

      // 2. Content optimization (30%) — thin sections, missing internal links
      const headings = html.match(/<h[2-6][^>]*>[\s\S]*?<\/h[2-6]>/gi) || [];
      const sections = html.split(/<h[2-6]/i).slice(1);
      let thickSections = 0;
      for (const section of sections) {
        const sectionText = section.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const sectionWords = sectionText.split(/\s+/).filter(Boolean).length;
        if (sectionWords >= 100) thickSections++;
      }
      const contentScore = sections.length > 0 ? Math.round((thickSections / sections.length) * 100) : 100;

      // 3. Conversion (20%) — CTA elements
      const hasButton = /<button/i.test(html);
      const hasForm = /<form/i.test(html);
      const hasCta = /subscribe|signup|sign-up|get-started|try-free|download|contact/i.test(html);
      const conversionScore = (hasButton || hasForm || hasCta) ? 100 : 0;

      // 4. AEO optimization (25%) — FAQ schema, direct answers
      const hasFaq = /FAQPage/i.test(html);
      const firstParagraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
      const hasDirectAnswer = /\bis\s+(?:a|an|the)\s+/i.test(firstParagraph) || firstParagraph.split(/\s+/).length >= 20;
      const aeoScore = Math.round(((hasFaq ? 1 : 0) + (hasDirectAnswer ? 1 : 0)) / 2 * 100);

      const score = Math.round(
        perfScore * 0.25 + contentScore * 0.30 + conversionScore * 0.20 + aeoScore * 0.25
      );
      const passed = score >= 40;

      return {
        checkName: 'weekly-optimization',
        score,
        passed,
        severity: 'info',
        message: passed
          ? `Weekly optimization check passed (${score}/100). Good optimization baseline.`
          : `Weekly optimization opportunities found (${score}/100).`,
        details: { perfScore, contentScore, conversionScore, aeoScore, thickSections, totalSections: sections.length },
        fixSuggestion: !passed
          ? 'Add loading="lazy" to below-fold images, defer scripts, include FAQ schema, add clear CTAs.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'weekly-optimization',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Weekly optimization check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
