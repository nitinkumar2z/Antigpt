/**
 * @module weekly-seo-engine/config
 * @description Configuration constants for the Weekly SEO Operations Engine plugin.
 * Defines the composite-score threshold, failure mode, and per-check weights
 * used when computing the overall plugin result.
 */

/**
 * Static configuration shape for the Weekly SEO Operations Engine.
 *
 * All properties are deeply readonly to prevent accidental mutation at runtime.
 */
export interface WeeklySeoEngineConfig {
  /** Minimum weighted aggregate score (0–100) for the plugin to pass. */
  readonly threshold: number;
  /** Pipeline behaviour when the composite score falls below the threshold. */
  readonly failureMode: 'fail-open' | 'fail-closed';
  /** Per-check tuning parameters and weights. */
  readonly checks: {
    /** Weekly audit readiness check configuration. */
    readonly weeklyAudit: { readonly maxStalePages: number; readonly weight: number };
    /** Weekly fix-readiness check configuration. */
    readonly weeklyFixes: { readonly weight: number };
    /** Weekly optimization opportunities check configuration. */
    readonly weeklyOptimization: { readonly weight: number };
  };
}

/**
 * Central configuration object for the Weekly SEO Operations Engine.
 *
 * Check weights (must sum to 100):
 * | Check                | Weight |
 * |----------------------|--------|
 * | weekly-audit         |   35   |
 * | weekly-fixes         |   35   |
 * | weekly-optimization  |   30   |
 */
export const weeklySeoEngineConfig: WeeklySeoEngineConfig = {
  threshold: 60,
  failureMode: 'fail-open' as const,
  checks: {
    weeklyAudit: { maxStalePages: 10, weight: 35 },
    weeklyFixes: { weight: 35 },
    weeklyOptimization: { weight: 30 },
  },
};
