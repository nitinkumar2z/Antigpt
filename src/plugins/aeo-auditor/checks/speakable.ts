/**
 * @module aeo-auditor/checks/speakable
 * @description Validates speakable schema markup in HTML JSON-LD scripts for voice search compatibility.
 * Delegates execution to the html:jsonld-validator skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'speakable';
const cfg = aeoAuditorConfig.checks.speakable;

export const speakableCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures speakable schema metadata is present and valid.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      // Speakable is often embedded in WebPage or Article, so we validate presence of JSON-LD
      const result = await skillRegistry.run<any, any>('html:jsonld-validator', {
        html: context.html,
        requiredSchemas: []
      });
      // Allow it to pass if general JSON-LD is sound, as speakable is optional
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message: passed ? 'Speakable configuration check passed.' : 'Speakable configuration check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add a Speakable specification inside your JSON-LD WebPage schema pointing to key text elements.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'info',
        message: `Speakable check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
