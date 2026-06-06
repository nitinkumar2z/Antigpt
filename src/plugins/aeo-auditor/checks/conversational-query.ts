/**
 * @module aeo-auditor/checks/conversational-query
 * @description Validates the presence of conversational headings aligned with user search queries.
 * Delegates execution to the keyword-intent skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'conversational-query';
const cfg = aeoAuditorConfig.checks.conversationalQuery;

export const conversationalQueryCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures the page has conversational question-based headings.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('keyword-intent', {
        html: context.html,
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Conversational query headings check passed.' : 'Conversational query headings check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add conversational headings (questions using who, what, why, how) to match search queries.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Conversational query check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
