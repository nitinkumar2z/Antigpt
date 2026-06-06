/**
 * @fileoverview Accessibility check for the QA Automation plugin.
 * @module plugins/qa-automation/checks/accessibility
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const cfg = qaAutomationConfig.checks.accessibility;

/**
 * Validates WCAG 2.1 AA compliance signals by delegating to integration:accessibility-axe skill.
 */
export const accessibilityCheck: PluginCheck = {
  name: 'accessibility',
  description: 'Validates WCAG 2.1 AA accessibility compliance including lang, labels, alt text, landmarks, and keyboard nav.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('integration:accessibility-axe', {
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= cfg.minScore;

      return {
        checkName: 'accessibility',
        score,
        passed,
        severity: 'critical',
        message: passed
          ? `Accessibility check passed (${score}/100). WCAG compliance signals detected.`
          : `Accessibility check failed (${score}/100). Missing WCAG compliance signals.`,
        details: result,
        fixSuggestion: !passed
          ? 'Add lang attribute to <html>, ensure all form inputs have labels, provide alt text for images, and add ARIA landmark roles.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'accessibility',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Accessibility check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
