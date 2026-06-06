/**
 * @file Skill: html:structural-validator
 */

import type { SkillDefinition } from '../types.js';

export interface StructuralValidatorInput {
  html: string;
}

export interface StructuralValidatorOutput {
  h1Count: number;
  hasSkipNav: boolean;
  headingSequenceViolations: string[];
  score: number;
}

export const structuralValidatorSkill: SkillDefinition<StructuralValidatorInput, StructuralValidatorOutput> = {
  name: 'html:structural-validator',
  description: 'Audits outline structures (single H1, sequence of H2-H6) and skip-nav access.',

  async execute(input) {
    try {
      const html = input.html || '';
      
      // 1. H1 Count
      const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
      
      // 2. Skip Nav Link
      const hasSkipNav = /class="[^"]*skip-nav[^"]*"|href="#main-content"|class="[^"]*skip-link[^"]*"/gi.test(html) ||
                         html.toLowerCase().includes('skip to main content');

      // 3. Heading Sequence Violations
      const headingSequenceViolations: string[] = [];
      const headingTags = html.match(/<h[1-6][^>]*>/gi) || [];
      const levels = headingTags.map(tag => parseInt(tag.substring(2, 3), 10));
      
      let prevLevel = 0;
      for (const level of levels) {
        if (prevLevel > 0) {
          // If level jumps by more than 1 (e.g., h2 to h4), it's a violation
          if (level - prevLevel > 1) {
            headingSequenceViolations.push(`Heading level jump from H${prevLevel} directly to H${level}`);
          }
        }
        prevLevel = level;
      }

      let score = 100;
      if (h1Count !== 1) score -= 40;
      if (!hasSkipNav) score -= 20;
      score -= headingSequenceViolations.length * 15;
      
      score = Math.max(0, Math.min(100, score));

      return {
        h1Count,
        hasSkipNav,
        headingSequenceViolations,
        score
      };
    } catch (e) {
      return {
        h1Count: 0,
        hasSkipNav: false,
        headingSequenceViolations: [],
        score: 50 // Default fallback
      };
    }
  }
};
