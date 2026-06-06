/**
 * @module seo-auditor/checks/index-coverage
 * @description Audits indexability signals and indexing blockers (canonical, robots, headers).
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.indexCoverage;

export const indexCoverageCheck: PluginCheck = {
  name: 'index-coverage',
  description: 'Audits indexability signals and indexing blockers.',
  severity: 'info',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('technical-seo', {
        html: context.html,
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'index-coverage',
        score,
        passed,
        severity: 'info',
        message: passed ? 'Index coverage validation checks passed.' : 'Index coverage checks failed or have issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Ensure the canonical link is absolute, the page does not contain noindex directives, and is fully crawlable.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'index-coverage',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Index coverage check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
