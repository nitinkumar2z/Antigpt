/**
 * @module seo-auditor/checks/meta-description
 * @description Validates the HTML meta description tag for SEO compliance.
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.metaDescription;

export const metaDescriptionCheck: PluginCheck = {
  name: 'meta-description',
  description:
    'Validates the meta description for presence, optimal length, originality, and call-to-action inclusion.',
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
        checkName: 'meta-description',
        score,
        passed,
        severity: 'critical',
        message: passed ? 'Meta description passes all SEO checks.' : 'Meta description check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? `Write a unique meta description of ${CONFIG.minLength}–${CONFIG.maxLength} characters that summarises the page and includes a call-to-action.`
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'meta-description',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Meta description check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
