/**
 * @module aeo-auditor/checks/knowledge-graph
 * @description Validates Knowledge Graph alignment through entity linking.
 *
 * AI systems leverage Knowledge Graph connections (Wikipedia, Wikidata, etc.)
 * to disambiguate entities and validate content authority. This check ensures
 * entities are linked to external knowledge bases and named consistently.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'knowledge-graph';
const cfg = aeoAuditorConfig.checks.knowledgeGraph;

/**
 * Known Knowledge Graph endpoint patterns that signal entity linking.
 */
const KG_LINK_PATTERNS: readonly RegExp[] = [
  /wikipedia\.org/i,
  /wikidata\.org/i,
  /dbpedia\.org/i,
  /schema\.org/i,
  /freebase\.com/i,
  /geonames\.org/i,
  /musicbrainz\.org/i,
  /viaf\.org/i,
  /isni\.org/i,
  /orcid\.org/i,
  /linkedin\.com/i,
  /crunchbase\.com/i,
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
 * Strip HTML tags from a string.
 * @param html - Raw HTML string.
 * @returns Plain text with tags removed.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Collect all `sameAs` values from JSON-LD objects.
 * Also looks for `owl:sameAs` and `schema:sameAs`.
 *
 * @param blocks - Parsed JSON-LD objects.
 * @returns Array of sameAs URLs found.
 */
function collectSameAsValues(blocks: unknown[]): string[] {
  const values: string[] = [];

  function walk(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    /** Collect from sameAs, owl:sameAs, schema:sameAs */
    const sameAsKeys = ['sameAs', 'owl:sameAs', 'schema:sameAs'];
    for (const key of sameAsKeys) {
      const val = record[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        values.push(val.trim());
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string' && item.trim().length > 0) {
            values.push(item.trim());
          }
        }
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

  return values;
}

/**
 * Collect all `name` values from typed JSON-LD entities.
 * @param blocks - Parsed JSON-LD objects.
 * @returns Array of entity names.
 */
function collectEntityNames(blocks: unknown[]): string[] {
  const names: string[] = [];

  function walk(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    if (record['@type'] !== undefined && typeof record['name'] === 'string') {
      names.push(record['name'].trim());
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

  return names;
}

/**
 * Check whether entity names used in JSON-LD appear consistently in the page content.
 * @param names - Entity names from JSON-LD.
 * @param rawContent - Plain text content.
 * @returns The fraction (0-1) of entity names found in the content.
 */
function checkNamingConsistency(names: string[], rawContent: string): number {
  if (names.length === 0) return 0;

  const lowerContent = rawContent.toLowerCase();
  let found = 0;

  for (const name of names) {
    if (name.length < 2) continue;
    if (lowerContent.includes(name.toLowerCase())) {
      found += 1;
    }
  }

  return names.length === 0 ? 0 : found / names.length;
}

/**
 * Count how many sameAs values link to recognised Knowledge Graph endpoints.
 * @param sameAsValues - Array of sameAs URLs.
 * @returns Number of KG-linked sameAs values.
 */
function countKgLinks(sameAsValues: string[]): number {
  let count = 0;
  for (const url of sameAsValues) {
    if (KG_LINK_PATTERNS.some((p) => p.test(url))) {
      count += 1;
    }
  }
  return count;
}

/**
 * AEO check: Knowledge Graph Alignment.
 *
 * Validates that entities in JSON-LD are linked to external Knowledge Graphs
 * via sameAs properties, named consistently throughout the page, and connected
 * to recognised KG endpoints.
 *
 * Scoring breakdown:
 * - 40 %: Has sameAs properties linking to external URIs.
 * - 30 %: Consistent entity naming between JSON-LD and page content.
 * - 30 %: External KG links (Wikipedia, Wikidata, etc.).
 */
export const knowledgeGraphCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Checks Knowledge Graph alignment through sameAs links, consistent naming, and external KG references.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const blocks = extractJsonLdBlocks(context.html);

      if (blocks.length === 0) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'info',
          message: 'No JSON-LD structured data found for Knowledge Graph alignment.',
          details: { sameAsCount: 0, entityNames: [], kgLinks: 0 },
          fixSuggestion:
            'Add JSON-LD structured data with sameAs properties pointing to Wikipedia, Wikidata, or other Knowledge Graph endpoints.',
        };
      }

      const sameAsValues = collectSameAsValues(blocks);
      const entityNames = collectEntityNames(blocks);
      const namingConsistency = checkNamingConsistency(entityNames, context.rawContent);
      const kgLinks = countKgLinks(sameAsValues);

      /** Also check for owl:sameAs or schema:sameAs in raw HTML (RDFa). */
      const rdfaSameAs =
        /\b(owl|schema):sameAs\b/i.test(context.html) || /property\s*=\s*["']sameAs["']/i.test(context.html);

      /** Score: has sameAs (40 %) */
      const sameAsScore = sameAsValues.length > 0
        ? Math.min(40, Math.round((sameAsValues.length / 2) * 40))
        : rdfaSameAs
          ? 20
          : 0;

      /** Score: consistent naming (30 %) */
      const namingScore = Math.round(namingConsistency * 30);

      /** Score: KG links (30 %) */
      const kgScore = kgLinks >= 2 ? 30 : kgLinks === 1 ? 15 : 0;

      const score = sameAsScore + namingScore + kgScore;
      const passed = score >= 40;

      const issues: string[] = [];
      if (sameAsValues.length === 0 && !rdfaSameAs) {
        issues.push('No sameAs properties found in structured data.');
      }
      if (namingConsistency < 0.5 && entityNames.length > 0) {
        issues.push(
          `Only ${Math.round(namingConsistency * 100)}% of entity names from JSON-LD appear in the page content.`,
        );
      }
      if (kgLinks === 0) {
        issues.push('No links to recognised Knowledge Graph endpoints (Wikipedia, Wikidata, etc.).');
      }

      const message =
        issues.length === 0
          ? `Knowledge Graph alignment is strong: ${sameAsValues.length} sameAs link(s), ${kgLinks} KG endpoint(s).`
          : `Knowledge Graph alignment issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (sameAsValues.length === 0) {
        fixParts.push(
          'Add sameAs properties to your JSON-LD entities pointing to Wikipedia, Wikidata, or LinkedIn profiles.',
        );
      }
      if (namingConsistency < 0.5 && entityNames.length > 0) {
        fixParts.push('Use consistent entity names in both JSON-LD and your visible page content.');
      }
      if (kgLinks === 0) {
        fixParts.push('Link entities to recognised Knowledge Graph endpoints via sameAs URLs.');
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message,
        details: {
          sameAsValues: sameAsValues.slice(0, 20),
          sameAsCount: sameAsValues.length,
          entityNames: entityNames.slice(0, 20),
          namingConsistencyPercent: Math.round(namingConsistency * 100),
          kgLinkCount: kgLinks,
          hasRdfaSameAs: rdfaSameAs,
        },
        fixSuggestion: fixParts.length > 0 ? fixParts.join(' ') : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'info',
        message: `Knowledge Graph check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure JSON-LD structured data is valid and contains entity information.',
      };
    }
  },
};
