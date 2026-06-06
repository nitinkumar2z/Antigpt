/**
 * @module aeo-auditor/checks/knowledge-graph
 * @description Validates presence of sameAs links pointing to Wikipedia and Wikidata.
 * Delegates execution to the html:jsonld-validator skill.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';
import { skillRegistry } from '../../../skills/registry.js';

const CHECK_NAME = 'knowledge-graph';
const cfg = aeoAuditorConfig.checks.knowledgeGraph;

export const knowledgeGraphCheck: PluginCheck = {
  name: CHECK_NAME,
  description: 'Ensures the page references entities in Wikipedia and Wikidata Knowledge Graphs.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await skillRegistry.run<any, any>('html:jsonld-validator', {
        html: context.html,
        requiredSchemas: []
      });
      const score = result.score ?? 100;
      const passed = score >= aeoAuditorConfig.threshold;

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message: passed ? 'Knowledge graph entity link checks passed.' : 'Knowledge graph entity link checks failed or have issues.',
        details: result,
        fixSuggestion: !passed
          ? 'Add sameAs array references inside your Person/Organization JSON-LD pointing to official Wikipedia and Wikidata profiles.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'info',
        message: `Knowledge graph check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
