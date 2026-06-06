/**
 * @module seo-auditor/checks/adsense-policy
 * @description Validates the page for Google AdSense program policy compliance.
 * Delegates execution to the revenue-analysis skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.adsensePolicy;

export const adsensePolicyCheck: PluginCheck = {
  name: 'adsense-policy',
  description: 'Validates page content for Google AdSense policy compliance (content depth, lack of placeholders, safe content).',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('revenue-analysis', {
        html: context.html,
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'adsense-policy',
        score,
        passed,
        severity: 'critical',
        message: passed ? 'AdSense policy compliance checks passed.' : 'AdSense policy violation or warning detected.',
        details: result,
        fixSuggestion: !passed
          ? 'Add more unique textual content, remove placeholder text (e.g., Lorem Ipsum), and verify terms are compliant with publisher guidelines.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'adsense-policy',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `AdSense policy check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
