/**
 * @module aeo-auditor/checks/ai-parseable
 * @description Evaluates whether content is structured for easy AI parsing.
 *
 * AI systems parse content more effectively when it has clear section headers,
 * definitive (non-hedging) statements, consistent formatting, and a logical
 * information flow.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'ai-parseable';
const cfg = aeoAuditorConfig.checks.aiParseable;

/**
 * Hedging words that weaken definitiveness — AI prefers authoritative statements.
 */
const HEDGING_WORDS: readonly string[] = [
  'might',
  'could',
  'possibly',
  'perhaps',
  'maybe',
  'arguably',
  'somewhat',
  'potentially',
  'supposedly',
  'it seems',
  'it appears',
  'sort of',
  'kind of',
] as const;

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
 * Extract h2/h3 heading texts from the HTML.
 * @param html - Full page HTML.
 * @returns Array of heading text strings with their level.
 */
function extractSectionHeadings(html: string): Array<{ level: number; text: string }> {
  const pattern = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = stripTags(match[2]).trim();
    if (text.length > 0) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Evaluate the quality of section headers.
 *
 * Good headers are:
 * - Descriptive (> 2 words).
 * - Not overly generic ("Section 1", "Part A").
 * - Present in sufficient quantity for the content length.
 *
 * @param headings - Extracted heading objects.
 * @param wordCount - Total word count of the page.
 * @returns Score from 0-100.
 */
function evaluateHeaders(headings: Array<{ level: number; text: string }>, wordCount: number): number {
  if (headings.length === 0) return 0;

  const genericPatterns = [
    /^section\s*\d/i,
    /^part\s*[a-z\d]/i,
    /^chapter\s*\d/i,
    /^untitled/i,
  ];

  let descriptiveCount = 0;
  for (const heading of headings) {
    const words = heading.text.split(/\s+/).length;
    const isGeneric = genericPatterns.some((p) => p.test(heading.text));
    if (words >= 2 && !isGeneric) {
      descriptiveCount += 1;
    }
  }

  /** Check density: roughly 1 heading per 200-300 words is ideal. */
  const idealHeadings = Math.max(2, Math.floor(wordCount / 250));
  const densityRatio = Math.min(1, headings.length / idealHeadings);

  const descriptiveRatio = descriptiveCount / headings.length;

  return Math.round((descriptiveRatio * 0.6 + densityRatio * 0.4) * 100);
}

/**
 * Calculate the ratio of sentences that are definitive (non-hedging).
 * @param rawContent - Plain text content.
 * @returns Score from 0-100.
 */
function evaluateDefinitiveness(rawContent: string): number {
  const sentences = rawContent
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) return 0;

  let hedgingCount = 0;
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasHedging = HEDGING_WORDS.some((word) => {
      const pattern = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return pattern.test(lowerSentence);
    });
    if (hasHedging) {
      hedgingCount += 1;
    }
  }

  const definitiveRatio = 1 - hedgingCount / sentences.length;
  return Math.round(definitiveRatio * 100);
}

/**
 * Evaluate formatting consistency: lists, tables, and clear paragraph structure.
 * @param html - Full page HTML.
 * @returns Score from 0-100.
 */
function evaluateFormatting(html: string): number {
  let score = 0;

  /** Check for ordered/unordered lists. */
  const hasList = /<[ou]l[^>]*>/i.test(html);
  if (hasList) score += 30;

  /** Check for tables. */
  const hasTable = /<table[^>]*>/i.test(html);
  if (hasTable) score += 20;

  /** Check for well-formed paragraphs. */
  const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length;
  if (paragraphCount >= 3) score += 25;
  else if (paragraphCount >= 1) score += 10;

  /** Check for consistent use of emphasis/strong. */
  const hasEmphasis = /<(strong|em|b|i)[^>]*>/i.test(html);
  if (hasEmphasis) score += 15;

  /** Check for definition lists or blockquotes. */
  const hasDefinition = /<(dl|blockquote)[^>]*>/i.test(html);
  if (hasDefinition) score += 10;

  return Math.min(100, score);
}

/**
 * Evaluate logical content flow (introduction → body → conclusion).
 * @param html - Full page HTML.
 * @param rawContent - Plain text content.
 * @returns Score from 0-100.
 */
function evaluateLogicalFlow(html: string, rawContent: string): number {
  let score = 0;

  /** Check for an introduction section (content before first h2). */
  const firstH2Index = html.search(/<h2[^>]*>/i);
  if (firstH2Index > 0) {
    const preH2Content = stripTags(html.slice(0, firstH2Index)).trim();
    if (preH2Content.split(/\s+/).length >= 10) {
      score += 35;
    }
  }

  /** Check for multiple body sections (multiple h2s). */
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  if (h2Count >= 3) score += 35;
  else if (h2Count >= 2) score += 25;
  else if (h2Count >= 1) score += 15;

  /** Check for a conclusion (content after the last h2 section, or conclusion-like heading). */
  const conclusionPatterns = [
    /\b(conclusion|summary|final\s+thoughts?|takeaway|key\s+points?|in\s+summary|wrapping\s+up)\b/i,
  ];
  const hasConclusion = conclusionPatterns.some((p) => p.test(rawContent));
  if (hasConclusion) score += 30;
  else {
    /** Partial credit if content has sufficient length suggesting completeness. */
    const wordCount = rawContent.split(/\s+/).length;
    if (wordCount >= 500) score += 10;
  }

  return Math.min(100, score);
}

/**
 * AEO check: AI-Parseable Structure.
 *
 * Evaluates whether the content is structured in a way that AI systems can
 * easily parse, understand, and extract information from.
 *
 * Scoring breakdown:
 * - 25 %: Clear, descriptive section headers (h2/h3).
 * - 25 %: Definitive statements (low hedging ratio).
 * - 25 %: Consistent formatting (lists, tables, paragraphs).
 * - 25 %: Logical content flow (introduction, body, conclusion).
 */
export const aiParseableCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Evaluates AI-parseable content structure: clear headers, definitive statements, formatting, and logical flow.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const headings = extractSectionHeadings(context.html);
      const wordCount = context.metadata.wordCount || context.rawContent.split(/\s+/).length;

      const headerScore = evaluateHeaders(headings, wordCount);
      const definitiveScore = evaluateDefinitiveness(context.rawContent);
      const formattingScore = evaluateFormatting(context.html);
      const flowScore = evaluateLogicalFlow(context.html, context.rawContent);

      const score = Math.round(
        headerScore * 0.25 +
        definitiveScore * 0.25 +
        formattingScore * 0.25 +
        flowScore * 0.25,
      );

      const passed = score >= 50;

      const issues: string[] = [];
      if (headerScore < 50) {
        issues.push('Section headers are missing, generic, or insufficient for content length.');
      }
      if (definitiveScore < 50) {
        issues.push('Content uses too much hedging language (might, could, possibly, etc.).');
      }
      if (formattingScore < 50) {
        issues.push('Content lacks consistent formatting (lists, tables, structured paragraphs).');
      }
      if (flowScore < 50) {
        issues.push('Content lacks clear logical flow (introduction → body → conclusion).');
      }

      const message =
        issues.length === 0
          ? 'Content is well-structured for AI parsing.'
          : `AI-parseable structure issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (headerScore < 50) {
        fixParts.push('Add descriptive h2/h3 headers that summarise each section (≥ 2 words each).');
      }
      if (definitiveScore < 50) {
        fixParts.push(
          'Replace hedging language ("might", "could", "possibly") with definitive statements.',
        );
      }
      if (formattingScore < 50) {
        fixParts.push('Use lists, tables, and well-formed paragraphs for consistent formatting.');
      }
      if (flowScore < 50) {
        fixParts.push(
          'Structure content with a clear introduction, multiple body sections, and a conclusion.',
        );
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          headerScore,
          definitiveScore,
          formattingScore,
          logicalFlowScore: flowScore,
          headingCount: headings.length,
          wordCount,
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
        message: `AI-parseable check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML with heading and paragraph elements.',
      };
    }
  },
};
