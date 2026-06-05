/**
 * @fileoverview Default configuration for the Google Update Engine plugin.
 *
 * This module exports a single configuration object that controls thresholds,
 * failure behaviour, and per-check weighting parameters for Google algorithm
 * update resilience scoring.
 *
 * All numeric weights must sum to 100 across all enabled checks:
 *   updateMonitoring(30) + impactAnalysis(40) + remediationPlanning(30) = 100
 */

/**
 * Configuration shape for the Google Update Engine plugin.
 *
 * Each check entry exposes its relative weight in the overall resilience score.
 */
export interface GoogleUpdateEngineConfig {
  /** Minimum weighted average score (0–100) required to pass the gate. */
  readonly threshold: number;
  /** Failure semantics: 'fail-open' warns only, 'fail-closed' blocks publish. */
  readonly failureMode: 'fail-open' | 'fail-closed';
  /** Per-check weight configuration. */
  readonly checks: {
    /** Google update monitoring signals check. */
    readonly updateMonitoring: { readonly weight: number };
    /** Algorithm update vulnerability analysis check. */
    readonly impactAnalysis: { readonly weight: number };
    /** Remediation readiness evaluation check. */
    readonly remediationPlanning: { readonly weight: number };
  };
}

/**
 * Default Google Update Engine configuration.
 *
 * Weights intentionally sum to 100:
 *   updateMonitoring(30) + impactAnalysis(40) + remediationPlanning(30) = 100
 *
 * Uses `fail-open` mode — algorithm update vulnerability does not block
 * publishing but is flagged for remediation.
 */
export const googleUpdateEngineConfig: GoogleUpdateEngineConfig = {
  threshold: 55,
  failureMode: 'fail-open' as const,
  checks: {
    updateMonitoring: { weight: 30 },
    impactAnalysis: { weight: 40 },
    remediationPlanning: { weight: 30 },
  },
};
