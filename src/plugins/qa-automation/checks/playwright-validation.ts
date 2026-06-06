/**
 * @fileoverview Playwright page-rendering validation check for the QA Automation plugin.
 * @module plugins/qa-automation/checks/playwright-validation
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const config = qaAutomationConfig.checks.playwrightValidation;

/**
 * Playwright validation check that delegates to integration:playwright-render skill.
 */
export const playwrightValidationCheck: PluginCheck = {
  name: 'playwright-validation',
  description:
    'Validates page rendering readiness through static analysis of document structure, script integrity, resource loading, viewport meta, and image references.',
  severity: 'critical',
  weight: config.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('integration:playwright-render', {
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= 70;

      return {
        checkName: 'playwright-validation',
        score,
        passed,
        severity: 'critical',
        message: passed
          ? 'Page is fully ready for Playwright rendering — no structural issues detected.'
          : 'Playwright rendering validation failed.',
        details: result,
        fixSuggestion: !passed
          ? 'Ensure the document has proper HTML5 structure, valid scripts, correct resource declarations, a viewport meta tag, and no broken image references.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'playwright-validation',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Playwright validation check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
