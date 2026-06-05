/**
 * @module aeo-auditor/checks/entity-markup
 * @description Validates JSON-LD entity markup density and diversity.
 *
 * AI systems rely on structured data to understand entity relationships.
 * This check ensures the page has sufficient, diverse, and well-identified
 * entities in its JSON-LD blocks.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'entity-markup';
const cfg = aeoAuditorConfig.checks.entityMarkup;

/**
 * Entity types that are considered valuable for AI entity recognition.
 * A diverse mix signals a rich, well-annotated page.
 */
const VALUABLE_ENTITY_TYPES: readonly string[] = [
  'Person',
  'Organization',
  'Article',
  'Product',
  'WebPage',
  'WebSite',
  'Event',
  'HowTo',
  'Recipe',
  'Course',
  'Book',
  'CreativeWork',
  'LocalBusiness',
  'MedicalEntity',
  'SoftwareApplication',
  'VideoObject',
  'ImageObject',
  'BreadcrumbList',
  'ItemList',
  'FAQPage',
  'NewsArticle',
  'BlogPosting',
  'TechArticle',
  'ScholarlyArticle',
  'Review',
  'AggregateRating',
] as const;

/**
 * Properties that serve as entity identifiers, improving Knowledge Graph linkage.
 */
const IDENTIFIER_PROPERTIES: readonly string[] = [
  'name',
  'url',
  'sameAs',
  '@id',
  'identifier',
  'mainEntityOfPage',
] as const;

/**
 * Extract all JSON-LD blocks from the HTML.
 * @param html - Full page HTML.
 * @returns An array of parsed JSON objects. Malformed blocks are silently skipped.
 */
function extractJsonLdBlocks(html: string): unknown[] {
  const pattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: unknown[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      /* Malformed JSON-LD — skip silently. */
    }
  }

  return blocks;
}

/**
 * Recursively collect all `@type` values from a JSON-LD object graph.
 * @param obj - A parsed JSON-LD object or sub-object.
 * @param types - Accumulator set for discovered types.
 */
function collectTypes(obj: unknown, types: Set<string>): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectTypes(item, types);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record['@type'] === 'string') {
    types.add(record['@type']);
  } else if (Array.isArray(record['@type'])) {
    for (const t of record['@type']) {
      if (typeof t === 'string') {
        types.add(t);
      }
    }
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'object' && value !== null) {
      collectTypes(value, types);
    }
  }
}

/**
 * Count how many distinct `@type` mentions appear across all JSON-LD blocks.
 * @param blocks - Parsed JSON-LD objects.
 * @returns Total count of `@type` occurrences (not unique — raw mentions).
 */
function countEntityMentions(blocks: unknown[]): number {
  let count = 0;

  function walk(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;
    if (record['@type'] !== undefined) {
      count += 1;
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) {
        walk(value);
      }
    }
  }

  for (const block of blocks) {
    walk(block);
  }

  return count;
}

/**
 * Check whether entities carry identifying properties.
 * @param blocks - Parsed JSON-LD objects.
 * @returns The fraction (0-1) of typed entities that have at least one identifier.
 */
function identifierCoverage(blocks: unknown[]): number {
  let entitiesWithType = 0;
  let entitiesWithIdentifier = 0;

  function walk(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;
    if (record['@type'] !== undefined) {
      entitiesWithType += 1;
      const hasId = IDENTIFIER_PROPERTIES.some((prop) => {
        const value = record[prop];
        return value !== undefined && value !== null && value !== '';
      });
      if (hasId) {
        entitiesWithIdentifier += 1;
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) {
        walk(value);
      }
    }
  }

  for (const block of blocks) {
    walk(block);
  }

  return entitiesWithType === 0 ? 0 : entitiesWithIdentifier / entitiesWithType;
}

/**
 * AEO check: Entity Markup Density.
 *
 * Validates that the page contains sufficient, diverse, and well-identified
 * JSON-LD entities for AI systems to understand entity relationships.
 *
 * Scoring breakdown:
 * - 40 %: Entity count meets the configured minimum.
 * - 30 %: Diverse entity types from the valuable-types list.
 * - 30 %: Entities carry identifying properties (name, url, sameAs, etc.).
 */
export const entityMarkupCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Validates JSON-LD entity markup density, type diversity, and identifier coverage.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const blocks = extractJsonLdBlocks(context.html);

      if (blocks.length === 0) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'warning',
          message: 'No JSON-LD structured data found on the page.',
          details: { entityCount: 0, types: [], identifierRatio: 0 },
          fixSuggestion:
            'Add JSON-LD structured data with @type annotations for key entities (Article, Person, Organization, etc.).',
        };
      }

      const entityCount = countEntityMentions(blocks);
      const types = new Set<string>();
      for (const block of blocks) {
        collectTypes(block, types);
      }

      const valuableTypesFound = [...types].filter((t) =>
        VALUABLE_ENTITY_TYPES.some((vt) => t.toLowerCase() === vt.toLowerCase()),
      );

      const idRatio = identifierCoverage(blocks);

      /** Score: entity count (40 %) */
      const countScore = entityCount >= cfg.minEntities ? 40 : Math.round((entityCount / cfg.minEntities) * 40);

      /** Score: type diversity (30 %) — at least 2 distinct valuable types for full marks. */
      const diversityScore = valuableTypesFound.length >= 2 ? 30 : valuableTypesFound.length === 1 ? 15 : 0;

      /** Score: identifiers (30 %) */
      const identifierScore = Math.round(idRatio * 30);

      const score = countScore + diversityScore + identifierScore;
      const passed = score >= 60;

      const issues: string[] = [];
      if (entityCount < cfg.minEntities) {
        issues.push(
          `Found ${entityCount} entity mention(s) — need at least ${cfg.minEntities}.`,
        );
      }
      if (valuableTypesFound.length < 2) {
        issues.push(
          `Only ${valuableTypesFound.length} valuable entity type(s) found — add more diversity.`,
        );
      }
      if (idRatio < 0.8) {
        issues.push(
          `Only ${Math.round(idRatio * 100)}% of entities have identifying properties.`,
        );
      }

      const message =
        issues.length === 0
          ? `Entity markup is strong: ${entityCount} entities, ${valuableTypesFound.length} valuable types, ${Math.round(idRatio * 100)}% identifier coverage.`
          : `Entity markup issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (entityCount < cfg.minEntities) {
        fixParts.push(`Add more @type-annotated entities in your JSON-LD (target ≥ ${cfg.minEntities}).`);
      }
      if (valuableTypesFound.length < 2) {
        fixParts.push('Include diverse entity types such as Person, Organization, and Article.');
      }
      if (idRatio < 0.8) {
        fixParts.push('Ensure every typed entity has at least "name", "url", or "sameAs" properties.');
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          entityCount,
          typesFound: [...types],
          valuableTypesFound,
          identifierRatio: Math.round(idRatio * 100),
        },
        fixSuggestion: fixParts.length > 0 ? fixParts.join(' ') : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Entity markup check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure JSON-LD blocks contain valid JSON with @type annotations.',
      };
    }
  },
};
