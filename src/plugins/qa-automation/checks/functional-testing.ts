/**
 * @fileoverview Functional testing check for the QA Automation plugin.
 * @module plugins/qa-automation/checks/functional-testing
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const cfg = qaAutomationConfig.checks.functionalTesting;

/**
 * Validates functional integrity by delegating to technical-seo skill.
 */
export const functionalTestingCheck: PluginCheck = {
  name: 'functional-testing',
  description: 'Validates functional integrity including HTML completeness, duplicate IDs, form structure, and link targets.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('technical-seo', {
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= 60;

      return {
        checkName: 'functional-testing',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Functional testing passed (${score}/100). Page structure is sound.`
          : `Functional testing issues found (${score}/100). Structural problems detected.`,
        details: result,
        fixSuggestion: !passed
          ? 'Ensure HTML tags are properly closed, remove duplicate IDs, add rel="noopener" to external links.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'functional-testing',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Functional testing failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
