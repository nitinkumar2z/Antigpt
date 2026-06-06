/**
 * @module aeo-auditor/checks/ai-parseable
 * @description Validates semantic readability and HTML parsing clarity for LLM scrapers.
 * Delegates execution to the content-quality skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'ai-parseable';
const cfg = aeoAuditorConfig.checks.aiParseable;

export const aiParseableCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures the page HTML structure is easily parseable by AI spiders.',
  severity: 'warning',
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
        severity: 'warning',
        message: passed ? 'AI parseability check passed.' : 'AI parseability check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Use semantic HTML5 tags (article, section, main), and ensure no nested table layouts or dense nested divs.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `AI parseable check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
