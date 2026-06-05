/**
 * @module aeo-auditor/index
 * @description Main entry point for the AEO Compliance Auditor plugin.
 *
 * This plugin optimises content for AI search engines (Perplexity, Google AI
 * Overviews, ChatGPT Browse, Bing Copilot) to maximise AI citations and
 * answer engine visibility. It runs 10 checks covering direct-answer quotability,
 * structured data, conversational alignment, and more.
 *
 * @example
 * ```typescript
 * import { aeoAuditorPlugin } from './plugins/aeo-auditor/index.js';
 *
 * // Register with the plugin engine
 * engine.register(aeoAuditorPlugin);
 * ```
 */

import type { PluginDefinition } from '../engine/types.js';
import { aeoAuditorConfig } from './config.js';
import { directAnswerCheck } from './checks/direct-answer.js';
import { entityMarkupCheck } from './checks/entity-markup.js';
import { conversationalQueryCheck } from './checks/conversational-query.js';
import { faqSchemaCheck } from './checks/faq-schema.js';
import { speakableCheck } from './checks/speakable.js';
import { citationWorthinessCheck } from './checks/citation-worthiness.js';
import { aiParseableCheck } from './checks/ai-parseable.js';
import { eeatSignalsCheck } from './checks/eeat-signals.js';
import { knowledgeGraphCheck } from './checks/knowledge-graph.js';
import { llmsTxtCheck } from './checks/llms-txt.js';

/**
 * AEO Compliance Auditor plugin definition.
 *
 * Attaches to the `post-build` and `on-schedule` lifecycle hooks to audit
 * content for AI answer engine optimisation. The plugin uses a weighted
 * scoring system with a configurable pass/fail threshold (default: 65).
 *
 * The failure mode is `fail-open`, meaning plugin-level errors will not
 * block the publishing pipeline — they will be logged and reported.
 *
 * ### Checks (10 total, weights sum to 100):
 *
 * | Check               | Weight | Severity |
 * |---------------------|--------|----------|
 * | direct-answer       | 15     | critical |
 * | entity-markup       | 10     | warning  |
 * | conversational-query| 12     | warning  |
 * | faq-schema          | 12     | warning  |
 * | speakable           | 8      | info     |
 * | citation-worthiness | 13     | critical |
 * | ai-parseable        | 10     | warning  |
 * | eeat-signals        | 10     | warning  |
 * | knowledge-graph     | 5      | info     |
 * | llms-txt            | 5      | info     |
 */
export const aeoAuditorPlugin: PluginDefinition = {
  name: 'aeo-auditor',
  version: '1.0.0',
  description:
    'Optimizes content for AI search engines to maximize AI citations and answer engine visibility.',
  hooks: ['post-build', 'on-schedule'],
  failureMode: aeoAuditorConfig.failureMode,
  threshold: aeoAuditorConfig.threshold,
  checks: [
    directAnswerCheck,
    entityMarkupCheck,
    conversationalQueryCheck,
    faqSchemaCheck,
    speakableCheck,
    citationWorthinessCheck,
    aiParseableCheck,
    eeatSignalsCheck,
    knowledgeGraphCheck,
    llmsTxtCheck,
  ],
};
