/**
 * @fileoverview Structured data (JSON-LD) check for the Quality Gatekeeper plugin.
 *
 * Validates the presence and correctness of JSON-LD structured data embedded
 * in `<script type="application/ld+json">` blocks within the HTML.
 *
 * Scoring dimensions:
 * - **Presence** (40%): At least one JSON-LD block exists.
 * - **Valid JSON** (30%): All blocks parse as valid JSON.
 * - **Has @type** (20%): At least one block contains a `@type` property.
 * - **Has @context** (10%): At least one block contains a `@context` property.
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.structuredData;

/**
 * Regex to extract the content of `<script type="application/ld+json">` blocks.
 * Uses a non-greedy capture to handle multiple blocks correctly.
 */
const JSON_LD_REGEX =
  /<script\s[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Result of parsing and validating a single JSON-LD block.
 */
interface JsonLdBlock {
  /** Zero-based index of this block in the document. */
  index: number;
  /** The raw JSON string extracted from the script tag. */
  raw: string;
  /** Whether the block parsed as valid JSON. */
  isValidJson: boolean;
  /** The parsed JSON value, if valid. */
  parsed: unknown;
  /** Whether the parsed object contains a `@type` property. */
  hasType: boolean;
  /** Whether the parsed object contains a `@context` property. */
  hasContext: boolean;
  /** Parse error message, if applicable. */
  parseError?: string;
}

/**
 * Check whether a parsed JSON value contains a given property.
 *
 * Handles both top-level objects and `@graph` arrays.
 *
 * @param parsed  - The parsed JSON value.
 * @param property - The property name to look for (e.g., '@type').
 * @returns True if the property exists in the structure.
 */
function hasProperty(parsed: unknown, property: string): boolean {
  if (parsed === null || typeof parsed !== 'object') {
    return false;
  }

  const obj = parsed as Record<string, unknown>;

  // Direct property on root object
  if (property in obj) {
    return true;
  }

  // Check inside @graph array
  if (Array.isArray(obj['@graph'])) {
    return obj['@graph'].some(
      (item: unknown) =>
        item !== null && typeof item === 'object' && property in (item as Record<string, unknown>),
    );
  }

  // If the root is an array (less common but valid)
  if (Array.isArray(parsed)) {
    return parsed.some(
      (item: unknown) =>
        item !== null && typeof item === 'object' && property in (item as Record<string, unknown>),
    );
  }

  return false;
}

/**
 * Extract and validate all JSON-LD blocks from HTML.
 *
 * @param html - The full HTML string.
 * @returns Array of validated JSON-LD block results.
 */
function extractJsonLdBlocks(html: string): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];

  // Reset regex state
  JSON_LD_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = JSON_LD_REGEX.exec(html)) !== null) {
    const raw = (match[1] ?? '').trim();
    const block: JsonLdBlock = {
      index,
      raw,
      isValidJson: false,
      parsed: null,
      hasType: false,
      hasContext: false,
    };

    if (raw.length === 0) {
      block.parseError = 'Empty JSON-LD block';
    } else {
      try {
        const parsed: unknown = JSON.parse(raw);
        block.isValidJson = true;
        block.parsed = parsed;
        block.hasType = hasProperty(parsed, '@type');
        block.hasContext = hasProperty(parsed, '@context');
      } catch (e: unknown) {
        block.parseError =
          e instanceof Error ? e.message : 'Invalid JSON';
      }
    }

    blocks.push(block);
    index++;
  }

  return blocks;
}

/**
 * Structured data plugin check.
 *
 * Extracts JSON-LD blocks from the HTML and validates their structure
 * for presence, JSON validity, `@type`, and `@context`.
 */
export const structuredDataCheck: PluginCheck = {
  name: 'structured-data',
  description:
    'Validates JSON-LD structured data blocks for presence, valid JSON syntax, and required Schema.org properties (@type, @context).',
  severity: 'warning',
  weight: config.weight,

  /**
   * Execute the structured data check.
   *
   * @param context - The check context containing HTML.
   * @returns A CheckResult with the structured data validation score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'structured-data';

    try {
      const { html } = context;

      // Edge case: no HTML
      if (!html || html.trim().length === 0) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'warning',
          message: 'No HTML content available. Cannot check for structured data.',
          details: {
            totalBlocks: 0,
            validJson: 0,
            hasType: false,
            hasContext: false,
          },
          fixSuggestion: 'Add JSON-LD structured data to the page.',
        };
      }

      const blocks = extractJsonLdBlocks(html);
      const totalBlocks = blocks.length;

      // Scoring dimensions
      const hasPresence = totalBlocks > 0;
      const validJsonCount = blocks.filter((b) => b.isValidJson).length;
      const allValidJson = totalBlocks > 0 && validJsonCount === totalBlocks;
      const anyHasType = blocks.some((b) => b.hasType);
      const anyHasContext = blocks.some((b) => b.hasContext);

      // Calculate weighted score
      const presenceScore = hasPresence ? 40 : 0;
      const validJsonScore = allValidJson ? 30 : totalBlocks > 0 ? Math.round((validJsonCount / totalBlocks) * 30) : 0;
      const typeScore = anyHasType ? 20 : 0;
      const contextScore = anyHasContext ? 10 : 0;

      const score = presenceScore + validJsonScore + typeScore + contextScore;
      const passed = score >= 60;

      // Build message
      let message: string;
      if (score === 100) {
        message = `${totalBlocks} valid JSON-LD block(s) found with @type and @context.`;
      } else if (!hasPresence) {
        message = 'No JSON-LD structured data found on the page.';
      } else {
        const issues: string[] = [];
        if (!allValidJson) {
          issues.push(`${totalBlocks - validJsonCount} block(s) have invalid JSON`);
        }
        if (!anyHasType) {
          issues.push('no @type property found');
        }
        if (!anyHasContext) {
          issues.push('no @context property found');
        }
        message = `${totalBlocks} JSON-LD block(s) found, but issues detected: ${issues.join(', ')}.`;
      }

      // Collect block-level diagnostics
      const blockDiagnostics = blocks.map((b) => ({
        index: b.index,
        isValidJson: b.isValidJson,
        hasType: b.hasType,
        hasContext: b.hasContext,
        parseError: b.parseError ?? null,
        type: b.hasType && b.parsed && typeof b.parsed === 'object'
          ? ((b.parsed as Record<string, unknown>)['@type'] ?? null)
          : null,
      }));

      const result: CheckResult = {
        checkName,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          totalBlocks,
          validJsonBlocks: validJsonCount,
          invalidJsonBlocks: totalBlocks - validJsonCount,
          hasType: anyHasType,
          hasContext: anyHasContext,
          presenceScore,
          validJsonScore,
          typeScore,
          contextScore,
          blocks: blockDiagnostics,
        },
      };

      if (!passed) {
        const suggestions: string[] = [];
        if (!hasPresence) {
          suggestions.push(
            'Add a <script type="application/ld+json"> block with Schema.org structured data.',
          );
        }
        if (!allValidJson) {
          suggestions.push('Fix JSON syntax errors in existing JSON-LD blocks.');
        }
        if (hasPresence && !anyHasType) {
          suggestions.push('Add a @type property (e.g., "Article", "WebPage") to your JSON-LD.');
        }
        if (hasPresence && !anyHasContext) {
          suggestions.push(
            'Add @context: "https://schema.org" to your JSON-LD.',
          );
        }
        result.fixSuggestion = suggestions.join(' ');
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during structured data check';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Structured data check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the HTML contains valid JSON-LD blocks.',
      };
    }
  },
};
