/**
 * @fileoverview Tool Planner plugin entry point.
 *
 * This plugin validates architecture, URL structure, and database planning
 * for programmatic tool pages. It ensures that tool pages are well-architected
 * for performance and accessibility, have SEO-optimised URL structures, and
 * are backed by properly planned data sources for programmatic generation.
 *
 * The plugin attaches to the `pre-publish` lifecycle hook, blocking or
 * warning before content goes live depending on the configured failure mode.
 *
 * @example
 * ```typescript
 * import { toolPlannerPlugin } from './plugins/tool-planner/index.js';
 *
 * engine.registerPlugin(toolPlannerPlugin);
 * ```
 */

import type { PluginDefinition } from '../engine/types.js';
import { toolPlannerConfig } from './config.js';
import { architecturePlanningCheck } from './checks/architecture-planning.js';
import { urlPlanningCheck } from './checks/url-planning.js';
import { databasePlanningCheck } from './checks/database-planning.js';

/**
 * The Tool Planner plugin definition.
 *
 * Orchestrates three weighted checks and enforces a configurable minimum
 * score. Operates in `fail-open` mode by default — failures are logged
 * but do not block the publishing pipeline.
 *
 * Check weights (must sum to 100):
 * | Check                  | Weight | Severity |
 * |------------------------|--------|----------|
 * | architecture-planning  |   35   | warning  |
 * | url-planning           |   35   | critical |
 * | database-planning      |   30   | warning  |
 */
export const toolPlannerPlugin: PluginDefinition = {
  name: 'tool-planner',
  version: '1.0.0',
  description:
    'Validates architecture, URL structure, and database planning for programmatic tool pages.',
  hooks: ['pre-publish'],
  failureMode: toolPlannerConfig.failureMode,
  threshold: toolPlannerConfig.threshold,
  mcpDependencies: ['memory', 'postgres'],
  checks: [
    architecturePlanningCheck,
    urlPlanningCheck,
    databasePlanningCheck,
  ],
};
