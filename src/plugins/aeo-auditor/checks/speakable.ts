/**
 * @module aeo-auditor/checks/speakable
 * @description Validates Speakable structured data and TTS-friendly content.
 *
 * The Speakable specification tells voice assistants and AI readers which
 * parts of a page are most suitable for text-to-speech. This check validates
 * explicit speakable markup and, as a fallback, evaluates whether the content
 * is naturally TTS-friendly.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'speakable';
const cfg = aeoAuditorConfig.checks.speakable;

/**
 * Strip HTML tags from a string.
 * @param html - Raw HTML string.
 * @returns Plain text with tags removed.
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * Check whether any JSON-LD block contains SpeakableSpecification.
 * @param blocks - Parsed JSON-LD objects.
 * @returns `true` if speakable markup is present.
 */
function hasSpeakableInJsonLd(blocks: unknown[]): boolean {
  function walk(obj: unknown): boolean {
    if (obj === null || obj === undefined || typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
      return obj.some((item) => walk(item));
    }

    const record = obj as Record<string, unknown>;

    /** Direct speakable type. */
    if (record['@type'] === 'SpeakableSpecification') return true;

    /** Speakable property on another entity. */
    if (record['speakable'] !== undefined && record['speakable'] !== null) return true;

    return Object.values(record).some(
      (value) => typeof value === 'object' && value !== null && walk(value),
    );
  }

  return blocks.some((block) => walk(block));
}

/**
 * Check whether speakable markup references valid CSS selectors or XPaths.
 * @param blocks - Parsed JSON-LD objects.
 * @returns `true` if at least one valid selector/xpath reference is found.
 */
function hasValidSpeakableSelectors(blocks: unknown[]): boolean {
  function walk(obj: unknown): boolean {
    if (obj === null || obj === undefined || typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
      return obj.some((item) => walk(item));
    }

    const record = obj as Record<string, unknown>;

    /** Check cssSelector or xpath properties on speakable objects. */
    if (
      record['@type'] === 'SpeakableSpecification' ||
      (record['speakable'] !== undefined && record['speakable'] !== null)
    ) {
      const speakable = record['@type'] === 'SpeakableSpecification'
        ? record
        : record['speakable'];

      if (speakable !== null && typeof speakable === 'object') {
        const spec = speakable as Record<string, unknown>;
        if (hasNonEmptyStringOrArray(spec['cssSelector'])) return true;
        if (hasNonEmptyStringOrArray(spec['xpath'])) return true;
      }
    }

    return Object.values(record).some(
      (value) => typeof value === 'object' && value !== null && walk(value),
    );
  }

  return blocks.some((block) => walk(block));
}

/**
 * Check whether a value is a non-empty string or a non-empty array of strings.
 * @param value - The value to check.
 * @returns `true` if it contains non-empty content.
 */
function hasNonEmptyStringOrArray(value: unknown): boolean {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  if (Array.isArray(value)) {
    return value.some((v) => typeof v === 'string' && v.trim().length > 0);
  }
  return false;
}

/**
 * Check for speakable-related meta tags in the HTML.
 * @param html - Full page HTML.
 * @returns `true` if a speakable meta tag or data attribute is found.
 */
function hasSpeakableMeta(html: string): boolean {
  /** Check for meta tag indicating speakable. */
  const metaPattern = /<meta[^>]*name\s*=\s*["']speakable["'][^>]*>/i;
  if (metaPattern.test(html)) return true;

  /** Check for data-speakable attributes on elements. */
  const dataPattern = /data-speakable/i;
  return dataPattern.test(html);
}

/**
 * Evaluate whether the content has clear summary paragraphs suitable for TTS.
 *
 * TTS-friendly content has:
 * - Short, clear sentences (< 30 words average).
 * - Summary-like paragraphs at the beginning.
 * - Absence of complex formatting that would confuse TTS.
 *
 * @param html - Full page HTML.
 * @param rawContent - Plain text content.
 * @returns A score from 0-100 for TTS friendliness.
 */
function evaluateTtsFriendliness(html: string, rawContent: string): number {
  let score = 0;

  /** Check for short opening paragraphs (summary-like). */
  const pTagPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pTagPattern.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length > 0) {
    /** First 3 paragraphs should be concise for TTS. */
    const leadParagraphs = paragraphs.slice(0, 3);
    const avgWords =
      leadParagraphs.reduce(
        (sum, p) => sum + p.split(/\s+/).length,
        0,
      ) / leadParagraphs.length;

    if (avgWords <= 40) score += 40;
    else if (avgWords <= 60) score += 20;
  }

  /** Check average sentence length across the content. */
  const sentences = rawContent
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length > 0) {
    const avgSentenceWords =
      sentences.reduce(
        (sum, s) => sum + s.split(/\s+/).length,
        0,
      ) / sentences.length;

    if (avgSentenceWords <= 20) score += 30;
    else if (avgSentenceWords <= 30) score += 15;
  }

  /** Check for absence of heavy formatting that confuses TTS. */
  const hasHeavyTables = (html.match(/<table/gi) || []).length > 2;
  const hasExcessiveCode = (html.match(/<code/gi) || []).length > 5;

  if (!hasHeavyTables && !hasExcessiveCode) {
    score += 30;
  } else if (!hasHeavyTables || !hasExcessiveCode) {
    score += 15;
  }

  return Math.min(100, score);
}

/**
 * AEO check: Speakable Schema and TTS Friendliness.
 *
 * Checks for explicit SpeakableSpecification markup in JSON-LD or meta tags.
 * Falls back to evaluating whether the content is naturally suitable for
 * text-to-speech rendering.
 *
 * Scoring breakdown:
 * - Path A (speakable found): has-speakable-schema = 60 %, valid selectors bonus = 40 %.
 * - Path B (no speakable): has-tts-friendly-content = up to 40 %.
 */
export const speakableCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Checks for SpeakableSpecification markup and evaluates TTS-friendly content structure.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const blocks = extractJsonLdBlocks(context.html);
      const hasSpeakableSchema = hasSpeakableInJsonLd(blocks) || hasSpeakableMeta(context.html);
      const hasSelectors = hasSpeakableSchema ? hasValidSpeakableSelectors(blocks) : false;

      if (hasSpeakableSchema) {
        const schemaScore = 60;
        const selectorScore = hasSelectors ? 40 : 0;
        const score = schemaScore + selectorScore;
        const passed = score >= 60;

        const message = hasSelectors
          ? 'Speakable schema is present with valid CSS selectors or XPaths.'
          : 'Speakable schema is present but lacks valid CSS selectors or XPaths.';

        return {
          checkName: CHECK_NAME,
          score,
          passed,
          severity: 'info',
          message,
          details: {
            hasSpeakableSchema: true,
            hasValidSelectors: hasSelectors,
            ttsFriendlinessScore: null,
          },
          fixSuggestion: hasSelectors
            ? undefined
            : 'Add cssSelector or xpath properties to your SpeakableSpecification to indicate which elements should be spoken.',
        };
      }

      /** Fall back to TTS friendliness evaluation. */
      const ttsScore = evaluateTtsFriendliness(context.html, context.rawContent);
      /** Cap at 40 % when no explicit speakable markup exists. */
      const score = Math.min(40, Math.round(ttsScore * 0.4));
      const passed = score >= 25;

      const message =
        score >= 30
          ? 'No speakable markup found, but content is relatively TTS-friendly.'
          : 'No speakable markup found and content structure is not optimised for TTS.';

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message,
        details: {
          hasSpeakableSchema: false,
          hasValidSelectors: false,
          ttsFriendlinessScore: ttsScore,
        },
        fixSuggestion:
          'Add a SpeakableSpecification to your JSON-LD structured data with cssSelector or xpath properties pointing to the most quotable content sections.',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'info',
        message: `Speakable check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML and well-formed JSON-LD blocks.',
      };
    }
  },
};
