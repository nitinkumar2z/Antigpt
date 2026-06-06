/**
 * @module aeo-auditor/checks/llms-txt
 * @description Validates llms.txt compliance and AI-friendly content declarations.
 * Delegates execution to the technical-seo skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'llms-txt';
const cfg = aeoAuditorConfig.checks.llmsTxt;

export const llmsTxtCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures the page has machine-readable summaries, licensing info, and AI-interaction declarations.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('technical-seo', {
        html: context.html,
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message: passed ? 'LLMs txt compliance check passed.' : 'LLMs txt compliance check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add meta indicators for AI agents (robots-ai or ai-usage), include a copyright or license tag, and provide a machine-readable summary block.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'info',
        message: `LLMs txt check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
