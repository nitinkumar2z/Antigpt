/**
 * @module aeo-auditor/checks/citation-worthiness
 * @description Validates page references, external sources, and claims for citation eligibility.
 * Delegates execution to the text:eeat-credibility skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'citation-worthiness';
const cfg = aeoAuditorConfig.checks.citationWorthiness;

export const citationWorthinessCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures the page content has verifiable citation signals.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('text:eeat-credibility', {
        html: context.html,
        metadata: context.metadata
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'critical',
        message: passed ? 'Citation worthiness check passed.' : 'Citation worthiness check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add authoritative citations (<cite> tags or links to Wikipedia/DOIs) to substantiate claims.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Citation worthiness check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
