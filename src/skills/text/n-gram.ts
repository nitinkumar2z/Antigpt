/**
 * @file Skill: text:ngram-similarity
 */

import type { SkillDefinition } from '../types.js';

export interface NgramSimilarityInput {
  targetText: string;
  referenceTexts: string[];
  ngramSize?: number; // Default: 4
  maxDuplicateRatio?: number; // Default: 0.15
}

export interface NgramSimilarityOutput {
  duplicateRatio: number;
  uniqueNgramCount: number;
  duplicateNgramCount: number;
  score: number;
}

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 0);
}

function generateNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const ngrams: string[] = [];
  const limit = tokens.length - n + 1;
  for (let i = 0; i < limit; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function computeUniquenessRatio(ngrams: string[]): number {
  if (ngrams.length === 0) return 1;
  const unique = new Set(ngrams);
  return unique.size / ngrams.length;
}

export const ngramSimilaritySkill: SkillDefinition<NgramSimilarityInput, NgramSimilarityOutput> = {
  name: 'text:ngram-similarity',
  description: 'Generates n-gram token sets to assess text similarity against reference drafts.',

  async execute(input) {
    try {
      const ngramSize = input.ngramSize ?? 4;
      const maxDuplicateRatio = input.maxDuplicateRatio ?? 0.15;
      
      const tokens = tokenise(input.targetText);
      if (tokens.length < ngramSize) {
        return {
          duplicateRatio: 0,
          uniqueNgramCount: 0,
          duplicateNgramCount: 0,
          score: 70 // Fallback warning score
        };
      }

      // If referenceTexts are provided, we'd compare against them.
      // Since originality checks self-repetition currently, we check self-n-grams + references.
      const targetNgrams = generateNgrams(tokens, ngramSize);
      
      let duplicateRatio = 0;
      let uniqueCount = 0;
      let duplicateCount = 0;

      if (input.referenceTexts && input.referenceTexts.length > 0) {
        const refNgrams = new Set<string>();
        for (const text of input.referenceTexts) {
          const refTokens = tokenise(text);
          for (const ng of generateNgrams(refTokens, ngramSize)) {
            refNgrams.add(ng);
          }
        }
        for (const ng of targetNgrams) {
          if (refNgrams.has(ng)) {
            duplicateCount++;
          } else {
            uniqueCount++;
          }
        }
        duplicateRatio = duplicateCount / targetNgrams.length;
      } else {
        uniqueCount = new Set(targetNgrams).size;
        const uniquenessRatio = computeUniquenessRatio(targetNgrams);
        duplicateRatio = 1 - uniquenessRatio;
        duplicateCount = targetNgrams.length - uniqueCount;
      }

      let score = 0;
      if (duplicateRatio <= maxDuplicateRatio) {
        score = 100;
      } else {
        const ratio = Math.max(0, 1 - (duplicateRatio - maxDuplicateRatio)); // Rough degradation
        score = Math.round(ratio * 100);
      }

      return {
        duplicateRatio: Math.round(duplicateRatio * 1000) / 1000,
        uniqueNgramCount: uniqueCount,
        duplicateNgramCount: duplicateCount,
        score
      };
    } catch (e) {
      return {
        duplicateRatio: 0,
        uniqueNgramCount: 0,
        duplicateNgramCount: 0,
        score: 70
      };
    }
  }
};
