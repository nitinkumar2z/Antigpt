/**
 * @fileoverview Accessibility check for the QA Automation plugin.
 * @module plugins/qa-automation/checks/accessibility
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';

const cfg = qaAutomationConfig.checks.accessibility;

/**
 * Validates WCAG 2.1 AA compliance signals.
 *
 * Checks lang attribute, form labels, alt text, ARIA landmarks,
 * keyboard navigation, and skip navigation links.
 */
export const accessibilityCheck: PluginCheck = {
  name: 'accessibility',
  description: 'Validates WCAG 2.1 AA accessibility compliance including lang, labels, alt text, landmarks, and keyboard nav.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;

      // 1. Lang attribute (15%)
      const hasLang = /<html[^>]*\slang\s*=\s*["'][^"']+["']/i.test(html);
      const langScore = hasLang ? 100 : 0;

      // 2. Form labels (20%)
      const inputs = html.match(/<(?:input|select|textarea)[^>]*>/gi) || [];
      const hiddenInputs = inputs.filter((i) => /type\s*=\s*["']hidden["']/i.test(i) || /type\s*=\s*["']submit["']/i.test(i));
      const labelableInputs = inputs.length - hiddenInputs.length;
      let labeledCount = 0;
      for (const input of inputs) {
        if (/type\s*=\s*["'](?:hidden|submit)["']/i.test(input)) continue;
        if (/aria-label\s*=\s*["'][^"']+["']/i.test(input)) {
          labeledCount++;
        } else {
          const idMatch = input.match(/id\s*=\s*["']([^"']+)["']/i);
          if (idMatch && new RegExp(`<label[^>]*for\\s*=\\s*["']${idMatch[1]}["']`, 'i').test(html)) {
            labeledCount++;
          }
        }
      }
      const formLabelScore = labelableInputs > 0 ? Math.round((labeledCount / labelableInputs) * 100) : 100;

      // 3. Alt text (20%)
      const images = html.match(/<img[^>]*>/gi) || [];
      const imagesWithAlt = images.filter((img) => /alt\s*=\s*["'][^"']+["']/i.test(img)).length;
      const altScore = images.length > 0 ? Math.round((imagesWithAlt / images.length) * 100) : 100;

      // 4. ARIA landmarks (20%)
      const landmarks = ['main', 'navigation', 'banner', 'contentinfo'];
      const foundLandmarks = landmarks.filter((lm) =>
        new RegExp(`role\\s*=\\s*["']${lm}["']`, 'i').test(html)
      ).length;
      const landmarkScore = Math.round((foundLandmarks / landmarks.length) * 100);

      // 5. Keyboard navigation (15%)
      const focusableElements = (html.match(/<(?:a|button|input|select|textarea)\b/gi) || []).length;
      const keyboardScore = Math.min(focusableElements * 10, 100);

      // 6. Skip navigation (10%)
      const hasSkipNav = /skip[\s-]*(?:to[\s-]*)?(?:main|content|nav)/i.test(html);
      const skipNavScore = hasSkipNav ? 100 : 0;

      const score = Math.round(
        langScore * 0.15 + formLabelScore * 0.20 + altScore * 0.20 +
        landmarkScore * 0.20 + keyboardScore * 0.15 + skipNavScore * 0.10
      );
      const passed = score >= cfg.minScore;

      return {
        checkName: 'accessibility',
        score,
        passed,
        severity: 'critical',
        message: passed
          ? `Accessibility check passed (${score}/100). WCAG compliance signals detected.`
          : `Accessibility check failed (${score}/100). Missing WCAG compliance signals.`,
        details: { langScore, formLabelScore, altScore, landmarkScore, keyboardScore, skipNavScore, foundLandmarks },
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
