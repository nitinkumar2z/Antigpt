/**
 * @module aeo-auditor/checks/faq-schema
 * @description Validates FAQPage schema markup in HTML JSON-LD scripts.
 * Delegates execution to the html:jsonld-validator skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'faq-schema';
const cfg = aeoAuditorConfig.checks.faqSchema;

export const faqSchemaCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures FAQPage schema metadata is present and valid.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:jsonld-validator', {
        html: context.html,
        requiredSchemas: ['FAQPage']
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message: passed ? 'FAQPage schema check passed.' : 'FAQPage schema check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add FAQPage JSON-LD schema with questions and answers matching page headings.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `FAQPage schema check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
