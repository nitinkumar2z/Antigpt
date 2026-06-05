/**
 * @module aeo-auditor/config
 * @description Configuration constants for the AEO Compliance Auditor plugin.
 * All check weights, thresholds, and tuning parameters are centralised here
 * so they can be adjusted without modifying check logic.
 */

/**
 * Master configuration for the AEO Auditor plugin.
 *
 * - `threshold` — minimum weighted score (0-100) required for the plugin to pass.
 * - `failureMode` — `'fail-open'` means a plugin-level error will not block publishing.
 * - `checks` — per-check tuning knobs and relative weights (must sum to 100).
 */
export const aeoAuditorConfig = {
  /** Minimum weighted score required for the plugin to pass. */
  threshold: 65,

  /** Behaviour on plugin-level errors: continue publishing. */
  failureMode: 'fail-open' as const,

  /** Per-check configuration. */
  checks: {
    /** Direct-answer quotability settings. */
    directAnswer: {
      /** Maximum word count for an AI-quotable direct answer. */
      maxWords: 50,
      /** Number of leading words to inspect for the answer. */
      placement: 150,
      /** Relative weight in the overall score. */
      weight: 15,
    },

    /** Entity markup density settings. */
    entityMarkup: {
      /** Minimum number of distinct JSON-LD entities expected. */
      minEntities: 3,
      /** Relative weight in the overall score. */
      weight: 10,
    },

    /** Conversational query alignment settings. */
    conversationalQuery: {
      /** Relative weight in the overall score. */
      weight: 12,
    },

    /** FAQ schema validation settings. */
    faqSchema: {
      /** Minimum number of Q&A pairs expected in the FAQPage schema. */
      minPairs: 3,
      /** Relative weight in the overall score. */
      weight: 12,
    },

    /** Speakable markup settings. */
    speakable: {
      /** Relative weight in the overall score. */
      weight: 8,
    },

    /** Citation-worthiness evaluation settings. */
    citationWorthiness: {
      /** Minimum unique data points required. */
      minDataPoints: 2,
      /** Relative weight in the overall score. */
      weight: 13,
    },

    /** AI-parseable structure settings. */
    aiParseable: {
      /** Relative weight in the overall score. */
      weight: 10,
    },

    /** E-E-A-T signal settings. */
    eeatSignals: {
      /** Relative weight in the overall score. */
      weight: 10,
    },

    /** Knowledge Graph alignment settings. */
    knowledgeGraph: {
      /** Relative weight in the overall score. */
      weight: 5,
    },

    /** llms.txt compliance settings. */
    llmsTxt: {
      /** Relative weight in the overall score. */
      weight: 5,
    },
  },
} as const;
