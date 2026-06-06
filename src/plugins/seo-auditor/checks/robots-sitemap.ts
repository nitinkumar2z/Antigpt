/**
 * @module seo-auditor/checks/robots-sitemap
 * @description Audits the page context to verify correct indexing directives.
 * Delegates execution to the technical-seo skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.robotsSitemap;

export const robotsSitemapCheck: PluginCheck = {
  name: 'robots-sitemap',
  description: 'Audits indexing directives, robots tags, and sitemap references.',
  severity: 'warning',
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
        checkName: 'robots-sitemap',
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Robots and sitemap configurations pass all checks.' : 'Robots and sitemap checks failed or have issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add index/follow robots meta tags and ensure a sitemap reference is present in robots.txt.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'robots-sitemap',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Robots-sitemap check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
