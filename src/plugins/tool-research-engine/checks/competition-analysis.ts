/**
 * @fileoverview Competition analysis check for the Tool Research Engine.
 * @module plugins/tool-research-engine/checks/competition-analysis
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { toolResearchEngineConfig } from '../config.js';

const cfg = toolResearchEngineConfig.checks.competitionAnalysis;

/**
 * Analyzes competition landscape for a tool page.
 *
 * Evaluates keyword targeting, long-tail potential, unique value signals,
 * and content differentiation to determine competitive positioning.
 */
export const competitionAnalysisCheck: PluginCheck = {
  name: 'competition-analysis',
  description: 'Analyzes competition landscape including keyword targeting, long-tail potential, and differentiation signals.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata } = context;
      const title = metadata.title || '';

      // 1. Targetable keywords (25%)
      const hasKeywords = metadata.tags && metadata.tags.length > 0;
      const keywordScore = hasKeywords ? 100 : 0;

      // 2. Long-tail title (25%) — 3+ words indicates less competition
      const titleWords = title.trim().split(/\s+/).filter(Boolean).length;
      const longTailScore = titleWords >= 5 ? 100 : titleWords >= 3 ? 75 : Math.round((titleWords / 3) * 100);

      // 3. Unique value signals (25%) — interactive/tool elements
      const uniquePatterns = /(<form|<input|<canvas|<svg|calculator|converter|generator|checker)/gi;
      const uniqueMatches = (html.match(uniquePatterns) || []).length;
      const uniqueScore = Math.min(uniqueMatches * 20, 100);

      // 4. Differentiation (25%) — tables, lists, interactive elements
      const tables = (html.match(/<table/gi) || []).length;
      const lists = (html.match(/<(?:ul|ol)/gi) || []).length;
      const interactives = (html.match(/<(?:form|button|select|canvas)/gi) || []).length;
      const diffTotal = tables + lists + interactives;
      const diffScore = Math.min(diffTotal * 25, 100);

      const score = Math.round(
        keywordScore * 0.25 + longTailScore * 0.25 + uniqueScore * 0.25 + diffScore * 0.25
      );
      const passed = score >= 50;

      return {
        checkName: 'competition-analysis',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Competition analysis passed (${score}/100). Good competitive positioning.`
          : `Competition analysis needs improvement (${score}/100). Consider adding more differentiation.`,
        details: { keywordScore, longTailScore, uniqueScore, diffScore, titleWords, uniqueMatches },
        fixSuggestion: !passed
          ? 'Add targetable keyword tags, use longer descriptive titles, and include interactive elements like calculators or forms.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'competition-analysis',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Competition analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
