/**
 * @module seo-auditor/checks/core-web-vitals
 * @description Estimates Core Web Vitals readiness using playwright-render.
 * Delegates execution to the integration:playwright-render skill.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CONFIG = seoAuditorConfig.checks.coreWebVitals;

export const coreWebVitalsCheck: PluginCheck = {
  name: 'core-web-vitals',
  description: 'Estimates and scores Core Web Vitals loading metrics and layout shifts.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('integration:playwright-render', {
        url: context.url
      });
      const score = result.score ?? 100;
      const passed = score >= seoAuditorConfig.threshold;

      return {
        checkName: 'core-web-vitals',
        score,
        passed,
        severity: 'warning',
        message: passed ? 'Core Web Vitals scores are within budget.' : 'Core Web Vitals check failed or has budget overshoot.',
        details: result,
        fixSuggestion: !passed
          ? 'Optimize image assets, reduce unused JavaScript, and use CSS size-adjust to stabilize layouts.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'core-web-vitals',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Core Web Vitals check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
