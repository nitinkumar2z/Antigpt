/**
 * @module seo-auditor/checks/internal-links
 * @description Validates internal link structures for SEO compliance.
 * Delegates execution to the html:link-integrity skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.internalLinks;

export const internalLinksCheck: PluginCheck = {
  name: 'internal-links',
  description:
    'Validates internal link structures for presence, proper distribution, and absence of broken formats.',
  severity: 'warning',
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
        checkName: 'internal-links',
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Internal link structure passes all SEO checks.' : 'Internal link check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Ensure the page has at least 3 internal links, no broken formats, and uses absolute or root-relative paths.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'internal-links',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Internal link check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
