/**
 * @module tool-planner/config
 * @description Configuration constants for the Tool Planner plugin.
 * Defines thresholds, weights, and tuning parameters for architecture,
 * URL structure, and database planning checks.
 */

/**
 * Strongly-typed configuration interface for the Tool Planner plugin.
 *
 * All properties are `readonly` to prevent accidental mutation at runtime.
 */
export interface ToolPlannerConfig {
  /** Minimum weighted aggregate score (0–100) for the plugin to pass. */
  readonly threshold: number;

  /** Pipeline behaviour when the composite score falls below the threshold. */
  readonly failureMode: 'fail-open' | 'fail-closed';

  /** Per-check configuration. */
  readonly checks: {
    /** Architecture planning check parameters. */
    readonly architecturePlanning: { readonly weight: number };

    /** URL planning check parameters. */
    readonly urlPlanning: { readonly maxSlugLength: number; readonly weight: number };

    /** Database planning check parameters. */
    readonly databasePlanning: { readonly weight: number };
  };
}

/**
 * Default configuration for the Tool Planner plugin.
 *
 * Check weights sum to 100:
 * - architecturePlanning: 35
 * - urlPlanning:          35
 * - databasePlanning:     30
 */
export const toolPlannerConfig: ToolPlannerConfig = {
  threshold: 65,
  failureMode: 'fail-open' as const,
  checks: {
    architecturePlanning: { weight: 35 },
    urlPlanning: { maxSlugLength: 60, weight: 35 },
    databasePlanning: { weight: 30 },
  },
};
