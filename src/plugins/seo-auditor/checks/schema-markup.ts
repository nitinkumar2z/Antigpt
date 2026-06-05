/**
 * @module seo-auditor/checks/schema-markup
 * @description Validates Schema.org JSON-LD structured data for SEO compliance.
 * Checks for required and recommended schema types with property validation.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.schemaMarkup;

/** Schema types that earn bonus credit but are not mandatory. */
const RECOMMENDED_TYPES: readonly string[] = ['FAQ', 'HowTo', 'WebPage', 'Organization'];

/**
 * Maps schema types to their required properties for validation.
 * Only types with specific required properties are listed.
 */
const REQUIRED_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  Article: ['headline', 'datePublished', 'author'],
  NewsArticle: ['headline', 'datePublished', 'author'],
  BlogPosting: ['headline', 'datePublished', 'author'],
  BreadcrumbList: ['itemListElement'],
  FAQ: ['mainEntity'],
  HowTo: ['name', 'step'],
};

/**
 * Represents a parsed JSON-LD schema block.
 */
interface SchemaBlock {
  /** The @type value (may be a string or array). */
  type: string;
  /** All top-level property keys present in the block. */
  properties: string[];
  /** The raw parsed JSON object. */
  raw: Record<string, unknown>;
}

/**
 * Extracts and parses all JSON-LD script blocks from HTML.
 *
 * @param html - Full HTML source string.
 * @returns Array of parsed schema blocks. Malformed JSON is silently skipped.
 */
function extractJsonLdBlocks(html: string): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  const regex = /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const items = extractSchemaItems(parsed);
      blocks.push(...items);
    } catch {
      // Malformed JSON-LD — skip silently but don't crash.
    }
  }

  return blocks;
}

/**
 * Recursively extracts schema items from a parsed JSON-LD object.
 * Handles @graph arrays and nested objects.
 *
 * @param obj - A parsed JSON object.
 * @returns Flat array of schema blocks found.
 */
function extractSchemaItems(obj: Record<string, unknown>): SchemaBlock[] {
  const items: SchemaBlock[] = [];

  // Handle @graph array.
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      if (typeof item === 'object' && item !== null) {
        items.push(...extractSchemaItems(item as Record<string, unknown>));
      }
    }
    return items;
  }

  // Handle top-level array.
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        items.push(...extractSchemaItems(item as Record<string, unknown>));
      }
    }
    return items;
  }

  // Single schema object.
  const typeValue = obj['@type'];
  if (typeValue) {
    const types = Array.isArray(typeValue)
      ? (typeValue as string[])
      : [String(typeValue)];
    for (const t of types) {
      items.push({
        type: t,
        properties: Object.keys(obj).filter((k) => !k.startsWith('@')),
        raw: obj,
      });
    }
  }

  return items;
}

/**
 * Checks whether a schema block has all required properties for its type.
 *
 * @param block - The schema block to validate.
 * @returns Object with validation result and list of missing properties.
 */
function validateProperties(block: SchemaBlock): { valid: boolean; missing: string[] } {
  const required = REQUIRED_PROPERTIES[block.type];
  if (!required) {
    return { valid: true, missing: [] };
  }
  const missing = required.filter((prop) => !block.properties.includes(prop));
  return { valid: missing.length === 0, missing };
}

/**
 * PluginCheck that validates Schema.org JSON-LD structured data for SEO.
 *
 * Scoring breakdown:
 * - **Has JSON-LD (25%)**: At least one JSON-LD block is present.
 * - **Required types (35%)**: All required schema types are present.
 * - **Recommended types (15%)**: Bonus for recommended schema types.
 * - **Valid properties (25%)**: Required properties are present per type.
 *
 * @see seoAuditorConfig.checks.schemaMarkup
 */
export const schemaMarkupCheck: PluginCheck = {
  name: 'schema-markup',
  description:
    'Validates Schema.org JSON-LD for presence, required/recommended types, and property completeness.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const blocks = extractJsonLdBlocks(html);
      const foundTypes = new Set(blocks.map((b) => b.type));
      const issues: string[] = [];

      /* ---------- Has JSON-LD (25 pts) ---------- */
      let jsonLdScore = 0;
      if (blocks.length > 0) {
        jsonLdScore = 25;
      } else {
        issues.push('No JSON-LD structured data found.');
      }

      /* ---------- Required types (35 pts) ---------- */
      let requiredScore = 0;
      if (blocks.length > 0) {
        const requiredTypes = CONFIG.requiredTypes;
        const foundRequired = requiredTypes.filter((t) => {
          // Also match subtypes (e.g. BlogPosting satisfies Article).
          if (t === 'Article') {
            return foundTypes.has('Article') || foundTypes.has('NewsArticle') || foundTypes.has('BlogPosting');
          }
          return foundTypes.has(t);
        });
        const ratio = requiredTypes.length > 0 ? foundRequired.length / requiredTypes.length : 1;
        requiredScore = Math.round(ratio * 35);
        const missingRequired = requiredTypes.filter((t) => !foundRequired.includes(t));
        if (missingRequired.length > 0) {
          issues.push(`Missing required schema types: ${missingRequired.join(', ')}.`);
        }
      }

      /* ---------- Recommended types (15 pts) ---------- */
      let recommendedScore = 0;
      if (blocks.length > 0) {
        const foundRecommended = RECOMMENDED_TYPES.filter((t) => foundTypes.has(t));
        if (foundRecommended.length >= 2) {
          recommendedScore = 15;
        } else if (foundRecommended.length === 1) {
          recommendedScore = 10;
        } else {
          recommendedScore = 0;
          issues.push(
            `Consider adding recommended schema types: ${RECOMMENDED_TYPES.join(', ')}.`,
          );
        }
      }

      /* ---------- Valid properties (25 pts) ---------- */
      let propertiesScore = 0;
      if (blocks.length > 0) {
        let totalChecked = 0;
        let totalValid = 0;
        const propertyIssues: string[] = [];

        for (const block of blocks) {
          const { valid, missing } = validateProperties(block);
          if (REQUIRED_PROPERTIES[block.type]) {
            totalChecked++;
            if (valid) {
              totalValid++;
            } else {
              propertyIssues.push(
                `${block.type} is missing: ${missing.join(', ')}`,
              );
            }
          }
        }

        if (totalChecked === 0) {
          // No blocks with known required properties — grant full credit.
          propertiesScore = 25;
        } else {
          propertiesScore = Math.round((totalValid / totalChecked) * 25);
        }

        if (propertyIssues.length > 0) {
          issues.push(`Schema property issues: ${propertyIssues.join('; ')}.`);
        }
      }

      const totalScore = jsonLdScore + requiredScore + recommendedScore + propertiesScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'schema-markup',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Schema markup passes all SEO checks.'
            : issues.join(' '),
        details: {
          jsonLdBlockCount: blocks.length,
          foundTypes: Array.from(foundTypes),
          requiredTypes: [...CONFIG.requiredTypes],
          jsonLdScore,
          requiredScore,
          recommendedScore,
          propertiesScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Add JSON-LD blocks for required types (${CONFIG.requiredTypes.join(', ')}) with all mandatory properties (e.g. Article needs headline, datePublished, author).`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'schema-markup',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Schema markup check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the JSON-LD blocks — the schema markup check encountered an internal error.',
      };
    }
  },
};
