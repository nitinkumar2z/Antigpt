/**
 * @fileoverview Impact analysis check for the Google Update Response Engine.
 * @module plugins/google-update-engine/checks/impact-analysis
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { googleUpdateEngineConfig } from '../config.js';

const cfg = googleUpdateEngineConfig.checks.impactAnalysis;

/**
 * Analyzes vulnerability to Google algorithm updates.
 *
 * Evaluates content depth, over-optimization risks, link quality,
 * and user experience signals to assess update resilience.
 */
export const impactAnalysisCheck: PluginCheck = {
  name: 'impact-analysis',
  description: 'Analyzes vulnerability to algorithm updates including content depth, over-optimization, link quality, and UX signals.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata } = context;
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // 1. Content depth (30%)
      const wordCount = metadata.wordCount;
      const sections = (html.match(/<h[2-6]/gi) || []).length;
      const dataPoints = (textContent.match(/\d+(?:\.\d+)?%|\$\d+|\d{3,}/g) || []).length;
      const depthScore = Math.min(
        Math.round(
          (wordCount >= 500 ? 40 : (wordCount / 500) * 40) +
          (sections >= 3 ? 30 : (sections / 3) * 30) +
          Math.min(dataPoints * 10, 30)
        ),
        100
      );

      // 2. No over-optimization (25%)
      const words = textContent.toLowerCase().split(/\s+/).filter(Boolean);
      const wordFreq = new Map<string, number>();
      const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'and', 'but', 'or', 'not', 'no', 'this', 'that', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you', 'your']);
      for (const w of words) {
        if (w.length > 3 && !stopWords.has(w)) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
        }
      }
      let maxFreqRatio = 0;
      for (const [, count] of wordFreq) {
        const ratio = count / words.length;
        if (ratio > maxFreqRatio) maxFreqRatio = ratio;
      }
      const overOptScore = maxFreqRatio < 0.03 ? 100 : maxFreqRatio < 0.05 ? 60 : 20;

      // 3. Link quality (25%)
      const contextualLinks = (html.match(/<(?:p|article|section|div)[^>]*>[\s\S]*?<a\b/gi) || []).length;
      const navLinks = (html.match(/<nav[^>]*>[\s\S]*?<a\b/gi) || []).length;
      const totalLinks = contextualLinks + navLinks;
      const linkScore = totalLinks > 0 ? Math.round((contextualLinks / totalLinks) * 100) : 50;

      // 4. UX signals (20%)
      const images = html.match(/<img[^>]*>/gi) || [];
      const imagesWithDimensions = images.filter((i) =>
        /width\s*=/.test(i) && /height\s*=/.test(i)
      ).length;
      const hasPopup = /class\s*=\s*["'][^"']*(?:popup|modal|overlay|interstitial)[^"']*["']/i.test(html);
      const uxDimensionScore = images.length > 0 ? Math.round((imagesWithDimensions / images.length) * 100) : 100;
      const uxScore = hasPopup ? Math.round(uxDimensionScore * 0.5) : uxDimensionScore;

      const score = Math.round(
        depthScore * 0.30 + overOptScore * 0.25 + linkScore * 0.25 + uxScore * 0.20
      );
      const passed = score >= 50;

      return {
        checkName: 'impact-analysis',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Impact analysis passed (${score}/100). Low algorithm update vulnerability.`
          : `Impact analysis flagged (${score}/100). Potential vulnerability to updates.`,
        details: { depthScore, overOptScore, linkScore, uxScore, maxFreqRatio: maxFreqRatio.toFixed(4) },
        fixSuggestion: !passed
          ? 'Increase content depth, reduce keyword density below 3%, improve contextual linking, add image dimensions.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'impact-analysis',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
