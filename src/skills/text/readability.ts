/**
 * @file Skill: text:flesch-readability
 */

import type { SkillDefinition } from '../types.js';

export interface FleschReadabilityInput {
  text: string;
  minTargetScore?: number; // Default: 60
}

export interface FleschReadabilityOutput {
  fleschKincaidScore: number;
  gradeLevel: string;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  score: number;
}

const SENTENCE_TERMINATORS = /[.!?]+/g;
const VOWEL_GROUP = /[aeiouy]+/gi;
const WORD_SPLITTER = /\s+/;

function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (lower.length === 0) return 0;
  const matches = lower.match(VOWEL_GROUP);
  let count = matches ? matches.length : 1;
  if (lower.endsWith('e') && count > 1 && lower.length > 2) count -= 1;
  if (lower.endsWith('le') && lower.length > 2 && !/[aeiouy]/.test(lower[lower.length - 3])) count += 1;
  return Math.max(count, 1);
}

function extractWords(text: string): string[] {
  return text.split(WORD_SPLITTER).map((w) => w.replace(/[^a-zA-Z'-]/g, '')).filter((w) => w.length > 0);
}

function countSentences(text: string): number {
  const segments = text.split(SENTENCE_TERMINATORS).map((s) => s.trim()).filter((s) => s.length > 0);
  return Math.max(segments.length, 1);
}

export const fleschReadabilitySkill: SkillDefinition<FleschReadabilityInput, FleschReadabilityOutput> = {
  name: 'text:flesch-readability',
  description: 'Measures sentence, word, and syllable counts to evaluate content accessibility.',
  
  async execute(input) {
    try {
      const minTargetScore = input.minTargetScore ?? 60;
      
      if (!input.text || input.text.trim().length === 0) {
        return {
          fleschKincaidScore: 0,
          gradeLevel: 'Unknown',
          wordCount: 0,
          sentenceCount: 0,
          syllableCount: 0,
          score: 50 // Default fallback
        };
      }

      const words = extractWords(input.text);
      const totalWords = words.length;
      const totalSentences = countSentences(input.text);
      const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
      
      let fkScore = 0;
      if (totalWords > 0 && totalSentences > 0) {
        const raw = 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (totalSyllables / totalWords);
        fkScore = Math.max(0, Math.min(100, raw));
      }
      
      let score = 0;
      if (fkScore >= minTargetScore) {
        score = 100;
      } else {
        score = Math.round((fkScore / minTargetScore) * 100);
      }
      
      // Determine grade level
      let gradeLevel = 'College';
      if (fkScore > 90) gradeLevel = '5th Grade';
      else if (fkScore > 80) gradeLevel = '6th Grade';
      else if (fkScore > 70) gradeLevel = '7th Grade';
      else if (fkScore > 60) gradeLevel = '8th & 9th Grade';
      else if (fkScore > 50) gradeLevel = '10th to 12th Grade';
      else if (fkScore > 30) gradeLevel = 'College';
      else gradeLevel = 'College Graduate';

      return {
        fleschKincaidScore: Math.round(fkScore * 10) / 10,
        gradeLevel,
        wordCount: totalWords,
        sentenceCount: totalSentences,
        syllableCount: totalSyllables,
        score
      };
    } catch (e) {
      return {
        fleschKincaidScore: 0,
        gradeLevel: 'Error',
        wordCount: 0,
        sentenceCount: 0,
        syllableCount: 0,
        score: 50 // Default neutral pass fallback
      };
    }
  }
};
