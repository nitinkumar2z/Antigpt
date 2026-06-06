/**
 * @module aeo-auditor/checks/entity-markup
 * @description Validates entity markup in HTML JSON-LD scripts.
 * Delegates execution to the html:jsonld-validator skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'entity-markup';
const cfg = aeoAuditorConfig.checks.entityMarkup;

export const entityMarkupCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures Schema.org entity metadata is present and valid.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:jsonld-validator', {
        html: context.html,
        requiredSchemas: ['Organization', 'Person']
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Entity markup check passed.' : 'Entity markup check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add Organization or Person schemas to define key entities and link to Wikidata.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Entity markup check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
