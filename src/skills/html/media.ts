/**
 * @file Skill: html:media-accessibility
 */

import type { SkillDefinition } from '../types.js';

export interface MediaAccessibilityInput {
  html: string;
}

export interface MediaAccessibilityOutput {
  totalImagesCount: number;
  missingAltCount: number;
  missingDimensionsCount: number;
  missingLazyLoadCount: number;
  score: number;
}

export const mediaAccessibilitySkill: SkillDefinition<MediaAccessibilityInput, MediaAccessibilityOutput> = {
  name: 'html:media-accessibility',
  description: 'Audits image assets for alt tags, explicit sizes, and loading tags.',

  async execute(input) {
    try {
      const html = input.html || '';
      
      const imgRegex = /<img\s+([^>]+)>/gi;
      let match;
      let totalImagesCount = 0;
      let missingAltCount = 0;
      let missingDimensionsCount = 0;
      let missingLazyLoadCount = 0;

      while ((match = imgRegex.exec(html)) !== null) {
        totalImagesCount++;
        const attrs = match[1];
        
        // 1. Check alt tag
        const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
        // Alt attribute missing completely or alt text is empty (unless it's an empty alt for decorative images - but standard says missingAltCount increases if alt tag is missing or empty)
        if (!altMatch || altMatch[1].trim().length === 0) {
          missingAltCount++;
        }

        // 2. Check dimensions (width and height)
        const widthMatch = attrs.match(/width=["']\d+["']/i);
        const heightMatch = attrs.match(/height=["']\d+["']/i);
        if (!widthMatch || !heightMatch) {
          missingDimensionsCount++;
        }

        // 3. Check lazy loading
        const loadingMatch = attrs.match(/loading=["']lazy["']/i);
        if (!loadingMatch) {
          missingLazyLoadCount++;
        }
      }

      if (totalImagesCount === 0) {
        return {
          totalImagesCount: 0,
          missingAltCount: 0,
          missingDimensionsCount: 0,
          missingLazyLoadCount: 0,
          score: 100
        };
      }

      let score = 100 - (missingAltCount * 20) - (missingDimensionsCount * 5) - (missingLazyLoadCount * 5);
      score = Math.max(0, Math.min(100, score));

      return {
        totalImagesCount,
        missingAltCount,
        missingDimensionsCount,
        missingLazyLoadCount,
        score
      };
    } catch (e) {
      return {
        totalImagesCount: 0,
        missingAltCount: 0,
        missingDimensionsCount: 0,
        missingLazyLoadCount: 0,
        score: 100
      };
    }
  }
};
