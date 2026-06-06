/**
 * @file Skill: text:eeat-credibility
 */

import type { SkillDefinition } from '../types.js';

export interface EeatCredibilityInput {
  html: string;
  metadata: Record<string, any>;
}

export interface EeatCredibilityOutput {
  hasAuthorBio: boolean;
  citationCount: number;
  wikidataReferences: string[];
  score: number;
}

export const eeatCredibilitySkill: SkillDefinition<EeatCredibilityInput, EeatCredibilityOutput> = {
  name: 'text:eeat-credibility',
  description: 'Extracts author bios, citations, publish dates, and external Wikidata validation references.',

  async execute(input) {
    try {
      const htmlLower = (input.html || '').toLowerCase();
      
      // 1. Author Bio (+30)
      const hasAuthorBio = htmlLower.includes('author bio') || 
                           htmlLower.includes('written by') || 
                           !!input.metadata?.author;
      
      // 2. Citations (+15 each, max 45)
      // Count citations via <cite> tags, or links with citation classes, or reference patterns
      const citeMatches = htmlLower.match(/<cite[^>]*>|class="[^"]*citation[^"]*"|id="[^"]*cite[^"]*"/g) || [];
      const linkMatches = htmlLower.match(/href="[^"]*(wikipedia\.org|wikidata\.org|doi\.org)[^"]*"/g) || [];
      const totalCites = citeMatches.length + linkMatches.length;
      const citationCount = Math.min(3, totalCites);
      
      // 3. Wikidata references (+25)
      const wikidataMatches = (input.html || '').match(/https?:\/\/(www\.)?wikidata\.org\/wiki\/Q[0-9]+/g) || [];
      const wikidataReferences = Array.from(new Set(wikidataMatches));
      const hasWikidata = wikidataReferences.length > 0;

      let score = 0;
      if (hasAuthorBio) score += 30;
      score += citationCount * 15;
      if (hasWikidata) score += 25;

      score = Math.max(0, Math.min(100, score));

      return {
        hasAuthorBio,
        citationCount: totalCites,
        wikidataReferences,
        score
      };
    } catch (e) {
      return {
        hasAuthorBio: false,
        citationCount: 0,
        wikidataReferences: [],
        score: 40 // Default warning fallback
      };
    }
  }
};
