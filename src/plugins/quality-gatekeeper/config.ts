/**
 * @fileoverview Default configuration for the Quality Gatekeeper plugin.
 *
 * This module exports a single frozen configuration object that controls
 * thresholds, failure behaviour, and per-check tuning parameters.
 * All numeric weights must sum to 100 across all enabled checks.
 */

/**
 * Configuration shape for the quality gatekeeper plugin.
 * Each check entry exposes its tuning knobs and its relative weight
 * in the overall quality score.
 */
export interface QualityGatekeeperConfig {
  /** Minimum weighted average score (0-1000) required to pass the gate. */
  readonly threshold: number;
  /** Maximum score value (1000 for this plugin). */
  readonly scoreScale: number;
  /** Failure semantics: 'fail-closed' blocks publish, 'fail-open' warns only. */
  readonly failureMode: 'fail-closed' | 'fail-open';
  /** Per-check configuration. */
  readonly checks: {
    /** Flesch-Kincaid readability configuration. */
    readonly readability: {
      /** Minimum FK score considered "easy to read". */
      readonly minFleschKincaid: number;
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** Content depth / word-count configuration. */
    readonly contentDepth: {
      /** Minimum words for article-type content. */
      readonly minWordsArticle: number;
      /** Minimum words for generic page content. */
      readonly minWordsPage: number;
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** N-gram originality configuration. */
    readonly originality: {
      /** Maximum ratio of duplicate n-grams before flagging. */
      readonly maxDuplicateRatio: number;
      /** Size of n-grams used for fingerprinting. */
      readonly ngramSize: number;
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** Broken link format validation configuration. */
    readonly brokenLinks: {
      /** Timeout in ms for HTTP checks (used at engine level). */
      readonly timeout: number;
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** Image alt-text validation configuration. */
    readonly altText: {
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** JSON-LD structured data validation configuration. */
    readonly structuredData: {
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
    /** Content freshness decay configuration. */
    readonly freshness: {
      /** Maximum age in days before content scores zero. */
      readonly maxAgeDays: number;
      /** Exponential decay rate constant. */
      readonly decayRate: number;
      /** Relative weight in the overall score. */
      readonly weight: number;
    };
  };
}

/**
 * Default quality gatekeeper configuration.
 *
 * Weights intentionally sum to 100:
 *   readability(15) + contentDepth(20) + originality(20) + brokenLinks(15)
 *   + altText(10) + structuredData(10) + freshness(10) = 100
 */
export const qualityGatekeeperConfig: QualityGatekeeperConfig = {
  threshold: 800,
  scoreScale: 1000,
  failureMode: 'fail-closed' as const,
  checks: {
    readability: { minFleschKincaid: 60, weight: 15 },
    contentDepth: { minWordsArticle: 800, minWordsPage: 300, weight: 20 },
    originality: { maxDuplicateRatio: 0.15, ngramSize: 4, weight: 20 },
    brokenLinks: { timeout: 5000, weight: 15 },
    altText: { weight: 10 },
    structuredData: { weight: 10 },
    freshness: { maxAgeDays: 365, decayRate: 0.1, weight: 10 },
  },
};
