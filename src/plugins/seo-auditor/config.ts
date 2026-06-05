/**
 * @module seo-auditor/config
 * @description Configuration constants for the SEO Compliance Auditor plugin.
 * Defines thresholds, weights, and tuning parameters for all checks.
 */

/**
 * Central configuration object for the SEO auditor plugin.
 * Each check entry contains tuning parameters and a weight that determines
 * its contribution to the overall plugin score.
 */
export const seoAuditorConfig = {
  /** Minimum weighted aggregate score (0–100) for the plugin to pass. */
  threshold: 70,
  /** Pipeline behaviour on internal plugin error: 'fail-open' allows the build to continue. */
  failureMode: 'fail-open' as const,
  /** Per-check configuration keyed by check name. */
  checks: {
    /** Title tag length bounds and weight. */
    titleTag: { minLength: 30, maxLength: 65, weight: 12 },
    /** Meta description length bounds and weight. */
    metaDescription: { minLength: 120, maxLength: 160, weight: 10 },
    /** Heading hierarchy weight. */
    headingHierarchy: { weight: 8 },
    /** Canonical URL weight. */
    canonical: { weight: 10 },
    /** Internal linking minimum count and weight. */
    internalLinks: { minLinks: 3, weight: 10 },
    /** Schema.org JSON-LD required types and weight. */
    schemaMarkup: { requiredTypes: ['Article', 'BreadcrumbList'], weight: 10 },
    /** Social meta (OG + Twitter Card) weight. */
    socialMeta: { weight: 8 },
    /** Robots/sitemap coherence weight. */
    robotsSitemap: { weight: 8 },
    /** Core Web Vitals budget estimation parameters and weight. */
    coreWebVitals: { maxDomElements: 1500, maxImageSizeKb: 200, weight: 8 },
    /** AdSense policy compliance parameters and weight. */
    adsensePolicy: { minWordCount: 300, maxAdDensity: 0.3, weight: 8 },
    /** Hreflang tag weight. */
    hreflang: { weight: 4 },
    /** Index coverage signals weight. */
    indexCoverage: { weight: 4 },
  },
} as const;
