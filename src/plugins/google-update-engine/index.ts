/**
 * @fileoverview Google Update Engine plugin entry point.
 *
 * This plugin monitors Google algorithm update resilience, analyzes content
 * vulnerability to algorithm changes, and evaluates remediation readiness.
 * It runs three checks spanning update monitoring, impact analysis, and
 * remediation planning.
 *
 * The plugin attaches to two lifecycle hooks:
 * - `on-schedule` — runs periodic resilience audits against algorithm changes.
 * - `post-build`  — validates update-proofing after each static build.
 *
 * MCP dependencies:
 * - `fetch`   — for retrieving external algorithm update feeds
 * - `memory`  — for persisting historical update impact data
 * - `sqlite`  — for querying local content audit records
 *
 * @example
 * ```typescript
 * import { googleUpdateEnginePlugin } from './plugins/google-update-engine/index.js';
 *
 * engine.registerPlugin(googleUpdateEnginePlugin);
 * ```
 */

import type { PluginDefinition } from '../engine/types.js';
import { googleUpdateEngineConfig } from './config.js';
import { updateMonitoringCheck } from './checks/update-monitoring.js';
import { impactAnalysisCheck } from './checks/impact-analysis.js';
import { remediationPlanningCheck } from './checks/remediation-planning.js';

/**
 * The Google Update Engine plugin definition.
 *
 * Orchestrates three weighted resilience checks and enforces a configurable
 * minimum score for algorithm update preparedness. Operates in `fail-open`
 * mode by default — content that scores below threshold is flagged but not
 * blocked.
 *
 * Check weights (must sum to 100):
 * | Check                | Weight | Severity |
 * |----------------------|--------|----------|
 * | update-monitoring    |   30   | critical |
 * | impact-analysis      |   40   | warning  |
 * | remediation-planning |   30   | info     |
 */
export const googleUpdateEnginePlugin: PluginDefinition = {
  name: 'google-update-engine',
  version: '1.0.0',
  description:
    'Monitors Google algorithm updates, analyzes vulnerability, and ensures remediation readiness.',
  hooks: ['on-schedule', 'post-build'],
  failureMode: googleUpdateEngineConfig.failureMode,
  threshold: googleUpdateEngineConfig.threshold,
  mcpDependencies: ['fetch', 'memory', 'sqlite'],
  checks: [
    updateMonitoringCheck,
    impactAnalysisCheck,
    remediationPlanningCheck,
  ],
};
