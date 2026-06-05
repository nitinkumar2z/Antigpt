/**
 * @module aeo-auditor/checks/llms-txt
 * @description Validates llms.txt compliance and AI-friendly content declarations.
 *
 * The emerging llms.txt standard allows sites to declare how AI systems
 * should interact with their content. This check evaluates whether the page
 * provides machine-readable summaries, licensing information, and AI declarations.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'llms-txt';
const cfg = aeoAuditorConfig.checks.llmsTxt;

/**
 * Patterns that indicate llms.txt awareness via meta tags or headers.
 */
const LLMS_INDICATOR_PATTERNS: readonly RegExp[] = [
  /<meta[^>]*name\s*=\s*["'](llms|ai-usage|robots-ai|ai-content-policy)["'][^>]*>/i,
  /<meta[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*ai[^"']*["'][^>]*>/i,
  /<link[^>]*rel\s*=\s*["']llms[^"']*["'][^>]*>/i,
  /x-llms-txt/i,
  /x-ai-content-policy/i,
] as const;

/**
 * Patterns that indicate machine-readable summary sections.
 */
const MACHINE_SUMMARY_PATTERNS: readonly RegExp[] = [
  /<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']{20,}["'][^>]*>/i,
  /<meta[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["'][^"']{20,}["'][^>]*>/i,
  /class\s*=\s*["'][^"']*summary[^"']*["']/i,
  /class\s*=\s*["'][^"']*abstract[^"']*["']/i,
  /class\s*=\s*["'][^"']*tldr[^"']*["']/i,
  /class\s*=\s*["'][^"']*tl-dr[^"']*["']/i,
  /class\s*=\s*["'][^"']*key-?takeaway[^"']*["']/i,
  /<meta[^>]*name\s*=\s*["']abstract["'][^>]*>/i,
  /id\s*=\s*["'](summary|abstract|tldr|key-takeaway)["']/i,
] as const;

/**
 * Patterns that indicate content licensing declarations.
 */
const LICENSING_PATTERNS: readonly RegExp[] = [
  /\bcreative\s+commons\b/i,
  /\bCC[\s-]BY/i,
  /\bCC0\b/i,
  /\bMIT\s+License\b/i,
  /\bApache\s+License\b/i,
  /\bGPL\b/i,
  /\bAll\s+rights\s+reserved\b/i,
  /<meta[^>]*name\s*=\s*["'](copyright|license|rights)["'][^>]*>/i,
  /<link[^>]*rel\s*=\s*["']license["'][^>]*>/i,
  /\b©\b/,
  /&copy;/i,
  /\bcopyright\b/i,
  /rel\s*=\s*["']license["']/i,
] as const;

/**
 * Patterns that indicate an AI-friendly content declaration.
 */
const AI_DECLARATION_PATTERNS: readonly RegExp[] = [
  /<meta[^>]*name\s*=\s*["'](ai-usage|ai-training|ai-content-declaration)["'][^>]*>/i,
  /\bai[- ]?(training|usage|scraping|indexing)\s*(allowed|permitted|welcome|enabled)\b/i,
  /\b(allow|permit|enable)\s*(ai|llm|machine)\s*(training|usage|scraping|indexing)\b/i,
  /\bai[- ]?friendly\b/i,
  /\bmachine[- ]?readable\b/i,
  /data-ai-/i,
  /<meta[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*(ai|gpt|llm)[^"']*["'][^>]*>/i,
] as const;

/**
 * Test whether any pattern from a list matches the given text.
 * @param text - Text to search.
 * @param patterns - Array of regex patterns.
 * @returns `true` if at least one pattern matches.
 */
function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Count how many patterns from a list match in the given text.
 * @param text - Text to search.
 * @param patterns - Array of regex patterns.
 * @returns Number of distinct matching patterns.
 */
function countMatchingPatterns(text: string, patterns: readonly RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      count += 1;
    }
  }
  return count;
}

/**
 * AEO check: llms.txt Compliance.
 *
 * Evaluates whether the page declares its AI content policy, provides
 * machine-readable summaries, includes licensing information, and has
 * AI-friendly content declarations.
 *
 * Scoring breakdown:
 * - 30 %: Has llms.txt indicator (meta tag, header, or link).
 * - 30 %: Machine-readable summary sections (description, abstract, TLDR).
 * - 20 %: Content licensing indicators.
 * - 20 %: AI-friendly content declaration.
 */
export const llmsTxtCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Checks llms.txt compliance: AI content policy indicators, machine-readable summaries, licensing, and AI declarations.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const html = context.html;

      const hasIndicator = matchesAny(html, LLMS_INDICATOR_PATTERNS);
      const machineSummaryCount = countMatchingPatterns(html, MACHINE_SUMMARY_PATTERNS);
      const hasMachineSummary = machineSummaryCount > 0;
      const licensingCount = countMatchingPatterns(html, LICENSING_PATTERNS);
      const hasLicensing = licensingCount > 0;
      const aiDeclarationCount = countMatchingPatterns(html, AI_DECLARATION_PATTERNS);
      const hasAiDeclaration = aiDeclarationCount > 0;

      /** Score: indicator (30 %) */
      const indicatorScore = hasIndicator ? 30 : 0;

      /** Score: machine summary (30 %) — partial credit for meta description only. */
      const summaryScore = machineSummaryCount >= 2 ? 30 : machineSummaryCount === 1 ? 20 : 0;

      /** Score: licensing (20 %) */
      const licensingScore = hasLicensing ? 20 : 0;

      /** Score: AI declaration (20 %) */
      const declarationScore = hasAiDeclaration ? 20 : 0;

      const score = indicatorScore + summaryScore + licensingScore + declarationScore;
      const passed = score >= 30;

      const issues: string[] = [];
      if (!hasIndicator) {
        issues.push('No llms.txt or AI content policy indicator found.');
      }
      if (!hasMachineSummary) {
        issues.push('No machine-readable summary section found.');
      }
      if (!hasLicensing) {
        issues.push('No content licensing indicator found.');
      }
      if (!hasAiDeclaration) {
        issues.push('No AI-friendly content declaration found.');
      }

      const message =
        issues.length === 0
          ? 'Page has comprehensive llms.txt compliance with AI declarations, summaries, and licensing.'
          : `llms.txt compliance issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (!hasIndicator) {
        fixParts.push(
          'Add a <meta name="ai-usage"> tag or reference your llms.txt file via <link rel="llms">.',
        );
      }
      if (!hasMachineSummary) {
        fixParts.push(
          'Add machine-readable summary sections: meta description, og:description, or a TLDR/abstract section with appropriate class names.',
        );
      }
      if (!hasLicensing) {
        fixParts.push(
          'Include a licensing indicator (Creative Commons, copyright notice, or a <link rel="license"> tag).',
        );
      }
      if (!hasAiDeclaration) {
        fixParts.push(
          'Add an AI content declaration via <meta name="ai-usage" content="..."> or similar.',
        );
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'info',
        message,
        details: {
          hasLlmsIndicator: hasIndicator,
          machineSummarySignals: machineSummaryCount,
          licensingSignals: licensingCount,
          aiDeclarationSignals: aiDeclarationCount,
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
        message: `llms.txt check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML with meta tags.',
      };
    }
  },
};
