export * from './types.js';
export * from './registry.js';
export * from './text/readability.js';
export * from './text/n-gram.js';
export * from './text/semantic.js';

import { skillRegistry } from './registry.js';
import { fleschReadabilitySkill } from './text/readability.js';
import { ngramSimilaritySkill } from './text/n-gram.js';
import { semanticMatchSkill } from './text/semantic.js';

// Register core text skills
skillRegistry.register(fleschReadabilitySkill);
skillRegistry.register(ngramSimilaritySkill);
skillRegistry.register(semanticMatchSkill);

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
