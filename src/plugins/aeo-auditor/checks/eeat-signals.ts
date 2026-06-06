/**
 * @module aeo-auditor/checks/eeat-signals
 * @description Validates author bio presence, Wikidata linkage, and citation depth.
 * Delegates execution to the text:eeat-credibility skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'eeat-signals';
const cfg = aeoAuditorConfig.checks.eeatSignals;

export const eeatSignalsCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Validates Experience, Expertise, Authoritativeness, and Trustworthiness elements.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('text:eeat-credibility', {
        html: context.html,
        metadata: context.metadata
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message: passed ? 'EEAT signals check passed.' : 'EEAT signals check failed or has issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add author info, short bio page reference, publisher Wikidata identifiers, and factual citations.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `EEAT signals check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
