export * from './types.js';
export * from './registry.js';
export * from './text/readability.js';
export * from './text/n-gram.js';
export * from './text/semantic.js';
export * from './text/eeat.js';
export * from './html/structural.js';
export * from './html/jsonld.js';
export * from './html/links.js';
export * from './html/media.js';
export * from './integration/playwright.js';
export * from './integration/network.js';
export * from './integration/cloudflare.js';
export * from './integration/github.js';
export * from './db/relational.js';
export * from './db/performance.js';

import { skillRegistry } from './registry.js';
import { fleschReadabilitySkill } from './text/readability.js';
import { ngramSimilaritySkill } from './text/n-gram.js';
import { semanticMatchSkill } from './text/semantic.js';
import { eeatCredibilitySkill } from './text/eeat.js';
import { structuralValidatorSkill } from './html/structural.js';
import { jsonldValidatorSkill } from './html/jsonld.js';
import { linkIntegritySkill } from './html/links.js';
import { mediaAccessibilitySkill } from './html/media.js';
import { playwrightRenderSkill, accessibilityAxeSkill } from './integration/playwright.js';
import { rssFeedMonitorSkill } from './integration/network.js';
import { cloudflareCheckSkill } from './integration/cloudflare.js';
import { githubStatusSkill } from './integration/github.js';
import { relationalPlannerSkill } from './db/relational.js';
import { performanceIndexSkill } from './db/performance.js';

// Register core text skills
skillRegistry.register(fleschReadabilitySkill);
skillRegistry.register(ngramSimilaritySkill);
skillRegistry.register(semanticMatchSkill);
skillRegistry.register(eeatCredibilitySkill);

// Register HTML skills
skillRegistry.register(structuralValidatorSkill);
skillRegistry.register(jsonldValidatorSkill);
skillRegistry.register(linkIntegritySkill);
skillRegistry.register(mediaAccessibilitySkill);

// Register Integration skills
skillRegistry.register(playwrightRenderSkill);
skillRegistry.register(accessibilityAxeSkill);
skillRegistry.register(rssFeedMonitorSkill);
skillRegistry.register(cloudflareCheckSkill);
skillRegistry.register(githubStatusSkill);

// Register Database skills
skillRegistry.register(relationalPlannerSkill);
skillRegistry.register(performanceIndexSkill);

import * as v1 from './v1-skills.js';
export * from './v1-skills.js';

skillRegistry.register(v1.toolResearchSkill);
skillRegistry.register(v1.keywordIntentSkill);
skillRegistry.register(v1.competitorAnalysisSkill);
skillRegistry.register(v1.programmaticSEOSkill);
skillRegistry.register(v1.contentQualitySkill);
skillRegistry.register(v1.technicalSEOSkill);
skillRegistry.register(v1.revenueAnalysisSkill);
skillRegistry.register(v1.deploymentSkill);
skillRegistry.register(v1.googleUpdateSkill);
skillRegistry.register(v1.recoverySkill);
