/**
 * @module seo-auditor/checks/title-tag
 * @description Validates the HTML <title> tag for SEO compliance.
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.titleTag;

export const titleTagCheck: PluginCheck = {
  name: 'title-tag',
  description:
    'Validates the <title> tag for presence, optimal length, keyword inclusion, and unique differentiation.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('technical-seo', {
        html: context.html,
        url: context.url,
        siteConfig: context.siteConfig
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'title-tag',
        score,
        passed,
        severity: 'critical',
        message: passed ? 'Title tag passes all SEO checks.' : 'Title tag check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? `Ensure the <title> is ${CONFIG.minLength}–${CONFIG.maxLength} characters, includes a target keyword, and differentiates from the site name.`
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'title-tag',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Title tag check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
