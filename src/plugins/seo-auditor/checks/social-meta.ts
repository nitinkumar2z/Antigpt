/**
 * @module seo-auditor/checks/social-meta
 * @description Validates Open Graph and Twitter Card tags for social media preview compatibility.
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.socialMeta;

export const socialMetaCheck: PluginCheck = {
  name: 'social-meta',
  description: 'Ensures Open Graph and Twitter Card tags are correctly populated for rich social previews.',
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
        checkName: 'social-meta',
        score,
        passed,
        severity: 'info',
        message: passed ? 'Social meta tags pass all validation checks.' : 'Social meta tags check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add essential Open Graph tags (og:title, og:description, og:image, og:url) and Twitter Card tags (twitter:card).'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'social-meta',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Social meta tags check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
