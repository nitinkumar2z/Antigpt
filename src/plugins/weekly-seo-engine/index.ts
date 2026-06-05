/**
 * @fileoverview Weekly SEO Operations Engine plugin entry point.
 * @module plugins/weekly-seo-engine
 */

import type { PluginDefinition } from '../engine/types.js';
import { weeklySeoEngineConfig } from './config.js';
import { weeklyAuditCheck } from './checks/weekly-audit.js';
import { weeklyFixesCheck } from './checks/weekly-fixes.js';
import { weeklyOptimizationCheck } from './checks/weekly-optimization.js';

/**
 * Weekly SEO Operations Engine plugin definition.
 *
 * Runs weekly SEO audits, generates fix recommendations,
 * and identifies optimization opportunities on a scheduled basis.
 */
export const weeklySeoEnginePlugin: PluginDefinition = {
  name: 'weekly-seo-engine',
  version: '1.0.0',
  description: 'Runs weekly SEO audits, generates fix recommendations, and identifies optimization opportunities.',
  hooks: ['on-schedule'],
  failureMode: weeklySeoEngineConfig.failureMode,
  threshold: weeklySeoEngineConfig.threshold,
  mcpDependencies: ['sqlite', 'postgres', 'memory', 'fetch', 'playwright'],
  checks: [
    weeklyAuditCheck,
    weeklyFixesCheck,
    weeklyOptimizationCheck,
  ],
};
