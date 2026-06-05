/**
 * @fileoverview Default configuration for the QA Automation plugin.
 *
 * This module exports a single configuration object that controls thresholds,
 * failure behaviour, and per-check tuning parameters for page-quality
 * validation.  All numeric weights must sum to 100 across all enabled checks.
 *
 * Weight breakdown:
 *   playwrightValidation(35) + accessibility(35) + functionalTesting(30) = 100
 */

/**
 * Configuration shape for the QA Automation plugin.
 *
 * Each check entry exposes its tuning knobs and its relative weight
 * in the overall quality score.
 */
export interface QAAutomationConfig {
  /** Minimum weighted average score (0–100) required to pass the gate. */
  readonly threshold: number;
  /** Failure semantics: 'fail-closed' blocks publish, 'fail-open' warns only. */
  readonly failureMode: 'fail-open' | 'fail-closed';
  /** Per-check configuration. */
  readonly checks: {
    /** Playwright page-rendering validation configuration. */
    readonly playwrightValidation: { readonly weight: number };
    /** WCAG 2.1 AA accessibility compliance configuration. */
    readonly accessibility: { readonly minScore: number; readonly weight: number };
    /** Functional integrity testing configuration. */
    readonly functionalTesting: { readonly weight: number };
  };
}

/**
 * Default QA Automation configuration.
 *
 * Operates in `fail-closed` mode by default — pages that cannot be validated
 * are blocked from publishing.  The threshold of 70 means at least 70/100
 * weighted quality score is required.
 */
export const qaAutomationConfig: QAAutomationConfig = {
  threshold: 70,
  failureMode: 'fail-closed' as const,
  checks: {
    playwrightValidation: { weight: 35 },
    accessibility: { minScore: 80, weight: 35 },
    functionalTesting: { weight: 30 },
  },
};
