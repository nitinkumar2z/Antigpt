/**
 * @fileoverview Quality Gatekeeper plugin entry point.
 *
 * This plugin prevents low-quality content from reaching production by acting
 * as the final gate before any page is published or updated.  It runs seven
 * checks spanning readability, content depth, originality, link integrity,
 * image accessibility, structured data, and content freshness.
 *
 * The plugin attaches to two lifecycle hooks:
 * - `pre-publish` — blocks publication when the weighted score falls below threshold.
 * - `on-schedule` — runs periodic audits of already-published content.
 *
 * @example
 * ```typescript
 * import { qualityGatekeeperPlugin } from './plugins/quality-gatekeeper/index.js';
 *
 * engine.registerPlugin(qualityGatekeeperPlugin);
 * ```
 */

import type { PluginDefinition } from '../engine/types.js';
import { qualityGatekeeperConfig } from './config.js';
import { readabilityCheck } from './checks/readability.js';
import { contentDepthCheck } from './checks/content-depth.js';
import { originalityCheck } from './checks/originality.js';
import { brokenLinksCheck } from './checks/broken-links.js';
import { altTextCheck } from './checks/alt-text.js';
import { structuredDataCheck } from './checks/structured-data.js';
import { freshnessCheck } from './checks/freshness.js';

/**
 * The Quality Gatekeeper plugin definition.
 *
 * Orchestrates seven weighted quality checks and enforces a configurable
 * minimum score before content can be published.  Operates in `fail-closed`
 * mode by default — content that cannot be scored is blocked.
 *
 * Check weights (must sum to 100):
 * | Check            | Weight | Severity |
 * |------------------|--------|----------|
 * | readability      |   15   | critical |
 * | content-depth    |   20   | critical |
 * | originality      |   20   | critical |
 * | broken-links     |   15   | warning  |
 * | alt-text         |   10   | warning  |
 * | structured-data  |   10   | warning  |
 * | freshness        |   10   | info     |
 */
export const qualityGatekeeperPlugin: PluginDefinition = {
  name: 'quality-gatekeeper',
  version: '1.0.0',
  description:
    'Prevents low-quality content from reaching production. Acts as the final gate before any page is published or updated.',
  hooks: ['pre-publish', 'on-schedule'],
  failureMode: qualityGatekeeperConfig.failureMode,
  threshold: qualityGatekeeperConfig.threshold,
  scoreScale: qualityGatekeeperConfig.scoreScale,
  checks: [
    readabilityCheck,
    contentDepthCheck,
    originalityCheck,
    brokenLinksCheck,
    altTextCheck,
    structuredDataCheck,
    freshnessCheck,
  ],
};
