/**
 * @file Skill: html:jsonld-validator
 */

import type { SkillDefinition } from '../types.js';

export interface JsonldValidatorInput {
  html: string;
  requiredSchemas: string[];
}

export interface JsonldValidatorOutput {
  parsedSchemas: string[];
  validationErrors: Array<{ schema: string; error: string }>;
  score: number;
}

export const jsonldValidatorSkill: SkillDefinition<JsonldValidatorInput, JsonldValidatorOutput> = {
  name: 'html:jsonld-validator',
  description: 'Scrapes JSON-LD scripts, parses structure, and validates presence of required fields.',

  async execute(input) {
    try {
      const html = input.html || '';
      const requiredSchemas = input.requiredSchemas || [];
      
      const jsonldRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      const parsedSchemas: string[] = [];
      const validationErrors: Array<{ schema: string; error: string }> = [];
      let deductions = 0;
      let hasUnparseableJson = false;

      while ((match = jsonldRegex.exec(html)) !== null) {
        const jsonText = match[1].trim();
        try {
          const parsed = JSON.parse(jsonText);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (item['@type']) {
              parsedSchemas.push(item['@type']);
              
              // Validate recommended fields
              if (item['@type'] === 'Article') {
                if (!item.headline) {
                  validationErrors.push({ schema: 'Article', error: 'Missing recommended property: headline' });
                  deductions += 10;
                }
                if (!item.author) {
                  validationErrors.push({ schema: 'Article', error: 'Missing recommended property: author' });
                  deductions += 10;
                }
              }
              if (item['@type'] === 'FAQPage' && !item.mainEntity) {
                validationErrors.push({ schema: 'FAQPage', error: 'Missing recommended property: mainEntity' });
                deductions += 10;
              }
            } else {
              validationErrors.push({ schema: 'Unknown', error: 'Missing @type definition' });
              deductions += 10;
            }
          }
        } catch (err: any) {
          validationErrors.push({ schema: 'JSON-LD Block', error: `JSON Parse Error: ${err.message}` });
          deductions += 10;
          hasUnparseableJson = true;
        }
      }

      // Check missing required schemas
      for (const req of requiredSchemas) {
        if (!parsedSchemas.includes(req)) {
          validationErrors.push({ schema: req, error: `Missing required schema: ${req}` });
          deductions += 30;
        }
      }

      let score = 100 - deductions;
      if (hasUnparseableJson && parsedSchemas.length === 0) {
        score = 0;
      }
      score = Math.max(0, Math.min(100, score));

      return {
        parsedSchemas,
        validationErrors,
        score
      };
    } catch (e) {
      return {
        parsedSchemas: [],
        validationErrors: [{ schema: 'System', error: 'Uncaught execution error' }],
        score: 0
      };
    }
  }
};
