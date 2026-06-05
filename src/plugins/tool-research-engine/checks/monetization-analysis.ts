/**
 * @fileoverview Monetization analysis check for the Tool Research Engine.
 * @module plugins/tool-research-engine/checks/monetization-analysis
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { toolResearchEngineConfig } from '../config.js';

const cfg = toolResearchEngineConfig.checks.monetizationAnalysis;

/**
 * Analyzes monetization potential for a tool page.
 *
 * Evaluates commercial intent signals, ad placement readiness,
 * affiliate-friendly structure, and user engagement potential.
 */
export const monetizationAnalysisCheck: PluginCheck = {
  name: 'monetization-analysis',
  description: 'Analyzes monetization potential including commercial intent, ad readiness, affiliate structure, and engagement.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata } = context;
      const lowerHtml = html.toLowerCase();

      // 1. Commercial intent (30%)
      const commercialTerms = ['pricing', 'compare', 'best', 'review', 'buy', 'free', 'premium', 'vs', 'comparison', 'top'];
      const commercialCount = commercialTerms.reduce(
        (sum, term) => sum + (lowerHtml.match(new RegExp(`\\b${term}\\b`, 'gi')) || []).length,
        0
      );
      const commercialScore = Math.min(commercialCount * 15, 100);

      // 2. Ad placement readiness (25%)
      const adScore = metadata.wordCount >= 500 ? 100 : Math.round((metadata.wordCount / 500) * 100);

      // 3. Affiliate-friendly structure (20%)
      const hasTable = /<table/i.test(html);
      const hasList = /<(?:ul|ol)/i.test(html);
      const affiliateScore = hasTable && hasList ? 100 : hasTable || hasList ? 50 : 0;

      // 4. Engagement potential (25%)
      const engagementPatterns = /<(?:form|input|button|canvas|select)/gi;
      const engagementCount = (html.match(engagementPatterns) || []).length;
      const engagementScore = Math.min(engagementCount * 20, 100);

      const score = Math.round(
        commercialScore * 0.30 + adScore * 0.25 + affiliateScore * 0.20 + engagementScore * 0.25
      );
      const passed = score >= 40;

      return {
        checkName: 'monetization-analysis',
        score,
        passed,
        severity: 'info',
        message: passed
          ? `Monetization analysis passed (${score}/100). Good revenue potential.`
          : `Monetization analysis low (${score}/100). Limited revenue signals.`,
        details: { commercialScore, adScore, affiliateScore, engagementScore, wordCount: metadata.wordCount },
        fixSuggestion: !passed
          ? 'Add comparison tables, ensure 500+ word content for ad placement, include interactive elements for engagement.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'monetization-analysis',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Monetization analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
