/**
 * @fileoverview Tool Research Engine plugin entry point.
 * @module plugins/tool-research-engine
 */

import type { PluginDefinition } from '../engine/types.js';
import { toolResearchEngineConfig } from './config.js';
import { competitionAnalysisCheck } from './checks/competition-analysis.js';
import { demandAnalysisCheck } from './checks/demand-analysis.js';
import { monetizationAnalysisCheck } from './checks/monetization-analysis.js';

/**
 * Tool Research Engine plugin definition.
 *
 * Analyzes competition, demand, and monetization potential for
 * programmatic tool pages before publishing.
 */
export const toolResearchEnginePlugin: PluginDefinition = {
  name: 'tool-research-engine',
  version: '1.0.0',
  description: 'Analyzes competition, demand, and monetization potential for programmatic tool pages.',
  hooks: ['pre-publish'],
  failureMode: toolResearchEngineConfig.failureMode,
  threshold: toolResearchEngineConfig.threshold,
  mcpDependencies: ['fetch', 'memory', 'context7'],
  checks: [
    competitionAnalysisCheck,
    demandAnalysisCheck,
    monetizationAnalysisCheck,
  ],
};
