/**
 * @module seo-auditor/checks/schema-markup
 * @description Validates Schema.org JSON-LD structured data for SEO compliance.
 * Delegates execution to the html:jsonld-validator skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.schemaMarkup;

export const schemaMarkupCheck: PluginCheck = {
  name: 'schema-markup',
  description:
    'Validates Schema.org JSON-LD for presence, required/recommended types, and property completeness.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:jsonld-validator', {
        html: context.html,
        requiredSchemas: CONFIG.requiredTypes
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'schema-markup',
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Schema markup passes all SEO checks.' : 'Schema markup check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? `Add JSON-LD blocks for required types (${CONFIG.requiredTypes.join(', ')}) with all mandatory properties.`
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'schema-markup',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Schema markup check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
