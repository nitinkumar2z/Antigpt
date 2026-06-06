/**
 * @module seo-auditor/checks/hreflang
 * @description Validates hreflang configuration on international page templates.
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.hreflang;

export const hreflangCheck: PluginCheck = {
  name: 'hreflang',
  description: 'Validates presence, format, and self-referencing properties of hreflang tags.',
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
        checkName: 'hreflang',
        score,
        passed,
        severity: 'info',
        message: passed ? 'Hreflang validation checks passed.' : 'Hreflang checks failed or have issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add alternate hreflang tags for target language locales, and ensure a self-referencing hreflang matching the canonical URL.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'hreflang',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Hreflang check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
