/**
 * @module seo-auditor/checks/heading-hierarchy
 * @description Validates the HTML heading structure (h1–h6) for SEO compliance.
 * Delegates execution to the html:structural-validator skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.headingHierarchy;

export const headingHierarchyCheck: PluginCheck = {
  name: 'heading-hierarchy',
  description:
    'Validates heading structure: single h1, no level skips, appropriate h1 length, and presence of subheadings.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:structural-validator', {
        html: context.html
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'heading-hierarchy',
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Heading hierarchy passes all SEO checks.' : 'Heading hierarchy check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Ensure exactly one h1 (≤70 chars), use h2–h6 subheadings, and avoid skipping heading levels.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'heading-hierarchy',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Heading hierarchy check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
