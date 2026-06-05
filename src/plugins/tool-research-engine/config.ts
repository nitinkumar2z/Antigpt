/**
 * @fileoverview Configuration for the Tool Research Engine plugin.
 * @module plugins/tool-research-engine/config
 */

/** Configuration shape for the tool research engine plugin. */
export interface ToolResearchEngineConfig {
  /** Minimum weighted average score (0-100) required to pass. */
  readonly threshold: number;
  /** Failure semantics. */
  readonly failureMode: 'fail-open' | 'fail-closed';
  /** Per-check configuration. */
  readonly checks: {
    readonly competitionAnalysis: { readonly maxDifficultyScore: number; readonly weight: number };
    readonly demandAnalysis: { readonly minSearchVolume: number; readonly weight: number };
    readonly monetizationAnalysis: { readonly minCpmEstimate: number; readonly weight: number };
  };
}

/**
 * Default tool research engine configuration.
 * Weights sum to 100: competitionAnalysis(35) + demandAnalysis(40) + monetizationAnalysis(25).
 */
export const toolResearchEngineConfig: ToolResearchEngineConfig = {
  threshold: 60,
  failureMode: 'fail-open' as const,
  checks: {
    competitionAnalysis: { maxDifficultyScore: 70, weight: 35 },
    demandAnalysis: { minSearchVolume: 100, weight: 40 },
    monetizationAnalysis: { minCpmEstimate: 2.0, weight: 25 },
  },
};
