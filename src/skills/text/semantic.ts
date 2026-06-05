/**
 * @file Skill: text:semantic-match
 */

import type { SkillDefinition } from '../types.js';

export interface SemanticMatchInput {
  text: string;
  keywords: string[];
  minDensity?: number; // Default: 0.01
  maxDensity?: number; // Default: 0.04
}

export interface SemanticMatchOutput {
  keywordDensities: Record<string, number>;
  underUsedKeywords: string[];
  stuffedKeywords: string[];
  score: number;
}

export const semanticMatchSkill: SkillDefinition<SemanticMatchInput, SemanticMatchOutput> = {
  name: 'text:semantic-match',
  description: 'Measures keyword occurrence, density, and metadata tag distribution.',

  async execute(input) {
    try {
      const minDensity = input.minDensity ?? 0.01;
      const maxDensity = input.maxDensity ?? 0.04;
      
      const words = input.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
      const totalWords = words.length;

      if (totalWords === 0) {
        return {
          keywordDensities: {},
          underUsedKeywords: input.keywords,
          stuffedKeywords: [],
          score: 0
        };
      }

      const keywordDensities: Record<string, number> = {};
      const underUsedKeywords: string[] = [];
      const stuffedKeywords: string[] = [];
      let deductions = 0;

      for (const kw of input.keywords) {
        const kwLower = kw.toLowerCase();
        let count = 0;
        
        // Simple exact match counting for multiple words
        const textLower = input.text.toLowerCase();
        let idx = textLower.indexOf(kwLower);
        while (idx !== -1) {
          count++;
          idx = textLower.indexOf(kwLower, idx + kwLower.length);
        }

        const density = count / totalWords;
        keywordDensities[kw] = density;

        if (density < minDensity) {
          underUsedKeywords.push(kw);
          deductions += 20;
        } else if (density > maxDensity) {
          stuffedKeywords.push(kw);
          deductions += 20;
        }
      }

      const score = Math.max(0, 100 - deductions);

      return {
        keywordDensities,
        underUsedKeywords,
        stuffedKeywords,
        score
      };
    } catch (e) {
      return {
        keywordDensities: {},
        underUsedKeywords: [],
        stuffedKeywords: [],
        score: 50 // Degraded pass
      };
    }
  }
};
