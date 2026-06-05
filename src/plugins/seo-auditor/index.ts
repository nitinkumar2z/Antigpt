/**
 * @fileoverview SEO Compliance Auditor plugin entry point.
 *
 * This plugin ensures every page meets Google technical SEO requirements and
 * follows programmatic SEO best practices for AdSense eligibility.  It runs
 * twelve checks spanning meta tags, heading structure, canonical URLs, internal
 * linking, schema markup, social meta, robots/sitemap coherence, Core Web
 * Vitals budget estimation, AdSense policy compliance, hreflang validation,
 * and index coverage signals.
 *
 * The plugin attaches to two lifecycle hooks:
 * - `post-build`    — audits pages after a static build completes.
 * - `on-schedule`   — runs periodic audits of already-published content.
 *
 * @example
 * ```typescript
 * import { seoAuditorPlugin } from './plugins/seo-auditor/index.js';
 *
 * engine.registerPlugin(seoAuditorPlugin);
 * ```
 */

import type { PluginDefinition } from '../engine/types.js';
import { seoAuditorConfig } from './config.js';
import { titleTagCheck } from './checks/title-tag.js';
import { metaDescriptionCheck } from './checks/meta-description.js';
import { headingHierarchyCheck } from './checks/heading-hierarchy.js';
import { canonicalCheck } from './checks/canonical.js';
import { internalLinksCheck } from './checks/internal-links.js';
import { schemaMarkupCheck } from './checks/schema-markup.js';
import { socialMetaCheck } from './checks/social-meta.js';
import { robotsSitemapCheck } from './checks/robots-sitemap.js';
import { coreWebVitalsCheck } from './checks/core-web-vitals.js';
import { adsensePolicyCheck } from './checks/adsense-policy.js';
import { hreflangCheck } from './checks/hreflang.js';
import { indexCoverageCheck } from './checks/index-coverage.js';

/**
 * The SEO Compliance Auditor plugin definition.
 *
 * Orchestrates twelve weighted SEO checks and enforces a configurable
 * minimum score.  Operates in `fail-open` mode by default — build
 * failures are logged but do not block the pipeline.
 *
 * Check weights (must sum to 100):
 * | Check              | Weight | Severity |
 * |--------------------|--------|----------|
 * | title-tag          |   12   | critical |
 * | meta-description   |   10   | critical |
 * | heading-hierarchy  |    8   | warning  |
 * | canonical          |   10   | critical |
 * | internal-links     |   10   | warning  |
 * | schema-markup      |   10   | warning  |
 * | social-meta        |    8   | info     |
 * | robots-sitemap     |    8   | warning  |
 * | core-web-vitals    |    8   | warning  |
 * | adsense-policy     |    8   | critical |
 * | hreflang           |    4   | info     |
 * | index-coverage     |    4   | info     |
 */
export const seoAuditorPlugin: PluginDefinition = {
  name: 'seo-auditor',
  version: '1.0.0',
  description:
    'Ensures every page meets Google technical SEO requirements and follows programmatic SEO best practices for AdSense eligibility.',
  hooks: ['post-build', 'on-schedule'],
  failureMode: seoAuditorConfig.failureMode,
  threshold: seoAuditorConfig.threshold,
  checks: [
    titleTagCheck,
    metaDescriptionCheck,
    headingHierarchyCheck,
    canonicalCheck,
    internalLinksCheck,
    schemaMarkupCheck,
    socialMetaCheck,
    robotsSitemapCheck,
    coreWebVitalsCheck,
    adsensePolicyCheck,
    hreflangCheck,
    indexCoverageCheck,
  ],
};
