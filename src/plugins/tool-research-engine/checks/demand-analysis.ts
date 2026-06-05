/**
 * @fileoverview Demand analysis check for the Tool Research Engine.
 * @module plugins/tool-research-engine/checks/demand-analysis
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { toolResearchEngineConfig } from '../config.js';

const cfg = toolResearchEngineConfig.checks.demandAnalysis;

/**
 * Analyzes search demand signals for a tool page.
 *
 * Evaluates searchable title patterns, question coverage, trending indicators,
 * and topic breadth to estimate demand potential.
 */
export const demandAnalysisCheck: PluginCheck = {
  name: 'demand-analysis',
  description: 'Analyzes search demand signals including searchable titles, question patterns, trending indicators, and topic breadth.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata } = context;
      const title = (metadata.title || '').toLowerCase();

      // 1. Searchable title (30%)
      const searchTerms = ['calculator', 'converter', 'generator', 'checker', 'tool', 'free', 'online'];
      const hasSearchTerm = searchTerms.some((t) => title.includes(t));
      const searchableScore = hasSearchTerm ? 100 : 0;

      // 2. Question coverage (25%) — question-patterned headings
      const questionHeadings = (html.match(/<h[2-6][^>]*>[^<]*(what|how|why|when|where|who|which|can|does|is|are|should)[^<]*\??<\/h[2-6]>/gi) || []).length;
      const questionScore = Math.min(questionHeadings * 25, 100);

      // 3. Trending indicators (20%)
      const currentYear = new Date().getFullYear().toString();
      const hasTrending = html.includes(currentYear) || /\b(latest|updated|new|recent)\b/i.test(html);
      const trendingScore = hasTrending ? 100 : 0;

      // 4. Topic breadth (25%) — internal links + FAQ sections
      const internalLinks = (html.match(/<a[^>]+href=["']\/[^"']*["']/gi) || []).length;
      const hasFaq = /<script[^>]*type=["']application\/ld\+json["'][^>]*>[^<]*FAQPage/i.test(html);
      const breadthSignals = internalLinks + (hasFaq ? 3 : 0);
      const breadthScore = Math.min(breadthSignals * 15, 100);

      const score = Math.round(
        searchableScore * 0.30 + questionScore * 0.25 + trendingScore * 0.20 + breadthScore * 0.25
      );
      const passed = score >= 50;

      return {
        checkName: 'demand-analysis',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Demand analysis passed (${score}/100). Strong search demand signals detected.`
          : `Demand analysis needs improvement (${score}/100). Weak search demand signals.`,
        details: { searchableScore, questionScore, trendingScore, breadthScore, questionHeadings, internalLinks },
        fixSuggestion: !passed
          ? 'Use searchable terms in title (calculator, tool, free), add question-patterned headings, and include FAQ sections.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'demand-analysis',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Demand analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
