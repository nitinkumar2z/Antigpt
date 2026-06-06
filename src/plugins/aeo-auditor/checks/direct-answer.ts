/**
 * @module aeo-auditor/checks/direct-answer
 * @description Validates that the page opens with an AI-quotable direct answer.
 * Delegates execution to the content-quality skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'direct-answer';
const cfg = aeoAuditorConfig.checks.directAnswer;

export const directAnswerCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Validates that the page opens with an AI-quotable direct answer.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('content-quality', {
        html: context.html,
        rawContent: context.rawContent
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'critical',
        message: passed
          ? 'Direct answer check passed. Page has a concise, quotable summary.'
          : 'Direct answer check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Provide a concise, direct answer in the first paragraph. Avoid filler phrases and define terms directly.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Direct answer check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
