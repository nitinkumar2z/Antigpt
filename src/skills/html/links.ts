/**
 * @file Skill: html:link-integrity
 */

import type { SkillDefinition } from '../types.js';

export interface LinkIntegrityInput {
  html: string;
  baseUrl: string;
}

export interface LinkIntegrityOutput {
  internalLinksCount: number;
  externalLinksCount: number;
  brokenFormats: string[];
  canonicalUrl: string | null;
  score: number;
}

export const linkIntegritySkill: SkillDefinition<LinkIntegrityInput, LinkIntegrityOutput> = {
  name: 'html:link-integrity',
  description: 'Extracts link structures, canonical link parameters, and validates link formatting.',

  async execute(input) {
    try {
      const html = input.html || '';
      const baseUrl = input.baseUrl || '';

      if (html.trim().length === 0) {
        return {
          internalLinksCount: 0,
          externalLinksCount: 0,
          brokenFormats: [],
          canonicalUrl: null,
          score: 60 // Fallback warning
        };
      }

      // 1. Extract canonical URL
      const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;

      // 2. Extract anchor links
      const anchorRegex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>/gi;
      let match;
      let internalLinksCount = 0;
      let externalLinksCount = 0;
      const brokenFormats: string[] = [];

      while ((match = anchorRegex.exec(html)) !== null) {
        const href = match[1].trim();
        
        // Check formatting
        if (href.length === 0 || href.startsWith('javascript:') || href.startsWith('#') && href === '#') {
          brokenFormats.push(href);
          continue;
        }

        // Check if internal/external
        const isAbsolute = /^[a-z0-9+.-]+:\/\//i.test(href);
        if (isAbsolute) {
          if (baseUrl && href.startsWith(baseUrl)) {
            internalLinksCount++;
          } else {
            externalLinksCount++;
          }
        } else {
          internalLinksCount++;
        }
      }

      let score = 100;
      score -= brokenFormats.length * 15;
      
      if (!canonicalUrl || !canonicalUrl.startsWith('https://')) {
        score -= 30;
      }
      
      score = Math.max(0, Math.min(100, score));

      return {
        internalLinksCount,
        externalLinksCount,
        brokenFormats,
        canonicalUrl,
        score
      };
    } catch (e) {
      return {
        internalLinksCount: 0,
        externalLinksCount: 0,
        brokenFormats: [],
        canonicalUrl: null,
        score: 60
      };
    }
  }
};
