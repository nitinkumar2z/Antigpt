/**
 * @module seo-auditor/checks/canonical
 * @description Validates the canonical URL link element for SEO compliance.
 * Delegates execution to the html:link-integrity skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.canonical;

export const canonicalCheck: PluginCheck = {
  name: 'canonical',
  description:
    'Validates the canonical URL for presence, absolute format, self-referencing correctness, and HTTPS usage.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:link-integrity', {
        html: context.html,
        baseUrl: context.siteConfig.baseUrl
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'canonical',
        score,
        passed,
        severity: 'critical',
        message: passed ? 'Canonical URL passes all SEO checks.' : 'Canonical URL check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? `Add a self-referencing <link rel="canonical" href="${context.url}"> using an absolute HTTPS URL.`
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'canonical',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Canonical URL check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
