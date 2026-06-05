/**
 * @module aeo-auditor/checks/citation-worthiness
 * @description Evaluates how citation-worthy the content is for AI answer engines.
 *
 * AI systems prefer to cite content that is backed by data, attributes sources,
 * uses authoritative language, and contains unique data points. This check
 * evaluates all four dimensions.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'citation-worthiness';
const cfg = aeoAuditorConfig.checks.citationWorthiness;

/**
 * Patterns that indicate data-backed claims in the content.
 */
const DATA_CLAIM_PATTERNS: readonly RegExp[] = [
  /\d+(\.\d+)?\s*%/,                          // percentages
  /\d{1,3}(,\d{3})+/,                         // large numbers with commas
  /\$\d+/,                                     // dollar amounts
  /€\d+/,                                      // euro amounts
  /£\d+/,                                      // pound amounts
  /\baccording\s+to\b/i,                       // source attribution
  /\bresearch\s+(shows?|indicates?|suggests?|finds?|found)\b/i,
  /\bstud(y|ies)\s+(shows?|indicates?|suggests?|finds?|found|reveal)/i,
  /\bdata\s+(shows?|indicates?|suggests?|reveals?)\b/i,
  /\bstatistics?\s+(shows?|indicates?|suggests?)\b/i,
  /\bsurvey\s+(shows?|indicates?|suggests?|found|reveals?)\b/i,
  /\breport(s|ed)?\s+(shows?|indicates?|that)\b/i,
  /\b\d+(\.\d+)?x\b/i,                        // multipliers (e.g. 2.5x)
  /\b\d+(\.\d+)?\s*(million|billion|trillion)\b/i,
] as const;

/**
 * Patterns that indicate source attribution.
 */
const SOURCE_ATTRIBUTION_PATTERNS: readonly RegExp[] = [
  /\baccording\s+to\b/i,
  /\b(source|citation|reference|cited|cite)\b/i,
  /\b(published|reported)\s+(by|in)\b/i,
  /\bas\s+(reported|noted|stated|described)\s+(by|in)\b/i,
  /<a[^>]+href\s*=\s*["']https?:\/\//i,       // external links
  /\[\d+\]/,                                    // numbered citations [1], [2]
  /\((19|20)\d{2}\)/,                          // year citations (2024)
] as const;

/**
 * Patterns that signal authoritative, expert tone.
 */
const AUTHORITATIVE_PATTERNS: readonly RegExp[] = [
  /\b(definitively|conclusively|unequivocally)\b/i,
  /\b(established|proven|demonstrated|confirmed|verified)\b/i,
  /\b(critical|essential|fundamental|key|crucial)\s+(factor|element|component|aspect)/i,
  /\b(best\s+practice|industry\s+standard|gold\s+standard)\b/i,
  /\b(expert|specialist|professional|authority|authoritative)\b/i,
  /\b(in\s+fact|notably|significantly|importantly)\b/i,
  /\b(evidence\s+suggests?|findings?\s+indicate)\b/i,
] as const;

/**
 * Count how many patterns from a list match in the given text.
 * @param text - Text to search.
 * @param patterns - Array of regex patterns to match.
 * @returns Number of distinct pattern matches found.
 */
function countPatternMatches(text: string, patterns: readonly RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    /** Use global flag to count all matches. */
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = text.match(globalPattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Count unique data points in the content.
 *
 * A "data point" is a numeric claim, statistic, or quantified fact.
 * We look for numbers in context (not just any number — it must be
 * part of a factual claim).
 *
 * @param text - Raw content text.
 * @returns Number of unique data points found.
 */
function countUniqueDataPoints(text: string): number {
  const dataPointPatterns: RegExp[] = [
    /\d+(\.\d+)?\s*%/g,                         // percentages
    /\d{1,3}(,\d{3})+(\.\d+)?/g,               // large numbers
    /\$[\d,.]+/g,                                // dollar amounts
    /€[\d,.]+/g,                                 // euro amounts
    /£[\d,.]+/g,                                 // pound amounts
    /\b\d+(\.\d+)?\s*(million|billion|trillion)\b/gi,
    /\b\d+(\.\d+)?x\b/gi,                       // multipliers
  ];

  const dataPoints = new Set<string>();

  for (const pattern of dataPointPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        dataPoints.add(m.trim().toLowerCase());
      }
    }
  }

  return dataPoints.size;
}

/**
 * AEO check: Citation Worthiness.
 *
 * Evaluates how likely AI answer engines are to cite this content based on
 * data-backed claims, source attribution, authoritative tone, and unique data.
 *
 * Scoring breakdown:
 * - 30 %: Data-backed claims (numbers, statistics, research references).
 * - 25 %: Source attribution (citations, external links, "according to").
 * - 25 %: Authoritative tone (definitive statements, expert language).
 * - 20 %: Unique data points (minimum from config).
 */
export const citationWorthinessCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Scores citation-worthiness for AI based on data claims, source attribution, authoritative tone, and unique data points.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const text = context.rawContent;

      if (text.trim().length === 0) {
        return {
          checkName: CHECK_NAME,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No content found to evaluate for citation worthiness.',
          details: {},
          fixSuggestion: 'Add substantive content with data-backed claims and source attributions.',
        };
      }

      const dataClaimCount = countPatternMatches(text, DATA_CLAIM_PATTERNS);
      const sourceCount = countPatternMatches(text, SOURCE_ATTRIBUTION_PATTERNS);
      const authoritativeCount = countPatternMatches(text, AUTHORITATIVE_PATTERNS);
      const uniqueDataPoints = countUniqueDataPoints(text);

      /** Also count external links in the HTML for source attribution. */
      const externalLinks = (context.html.match(/<a[^>]+href\s*=\s*["']https?:\/\/[^"']+["']/gi) || []).length;

      /** Score: data-backed claims (30 %) — target ≥ 3 for full marks. */
      const dataScore = Math.min(30, Math.round((dataClaimCount / 3) * 30));

      /** Score: source attribution (25 %) — target ≥ 2 attribution signals. */
      const attributionSignals = sourceCount + Math.min(externalLinks, 3);
      const sourceScore = Math.min(25, Math.round((attributionSignals / 3) * 25));

      /** Score: authoritative tone (25 %) — target ≥ 2 signals. */
      const authScore = Math.min(25, Math.round((authoritativeCount / 2) * 25));

      /** Score: unique data points (20 %) — uses config minimum. */
      const dataPointScore = uniqueDataPoints >= cfg.minDataPoints
        ? 20
        : Math.round((uniqueDataPoints / cfg.minDataPoints) * 20);

      const score = dataScore + sourceScore + authScore + dataPointScore;
      const passed = score >= 50;

      const issues: string[] = [];
      if (dataClaimCount === 0) {
        issues.push('No data-backed claims (statistics, percentages, research references) found.');
      }
      if (sourceCount === 0 && externalLinks === 0) {
        issues.push('No source attribution signals found.');
      }
      if (authoritativeCount === 0) {
        issues.push('Content lacks authoritative, expert-level tone markers.');
      }
      if (uniqueDataPoints < cfg.minDataPoints) {
        issues.push(
          `Only ${uniqueDataPoints} unique data point(s) found — need at least ${cfg.minDataPoints}.`,
        );
      }

      const message =
        issues.length === 0
          ? `Content is citation-worthy: ${dataClaimCount} data claim(s), ${sourceCount} source attribution(s), ${uniqueDataPoints} unique data point(s).`
          : `Citation worthiness issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (dataClaimCount === 0) {
        fixParts.push('Add specific data points — percentages, statistics, or research findings.');
      }
      if (sourceCount === 0 && externalLinks === 0) {
        fixParts.push('Cite authoritative sources with "according to" phrases or link to research.');
      }
      if (authoritativeCount === 0) {
        fixParts.push('Use definitive, expert language — avoid vague hedging.');
      }
      if (uniqueDataPoints < cfg.minDataPoints) {
        fixParts.push(`Include at least ${cfg.minDataPoints} unique quantified facts or statistics.`);
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'critical',
        message,
        details: {
          dataClaimCount,
          sourceAttributionCount: sourceCount,
          authoritativeToneCount: authoritativeCount,
          uniqueDataPoints,
          externalLinkCount: externalLinks,
        },
        fixSuggestion: fixParts.length > 0 ? fixParts.join(' ') : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkName: CHECK_NAME,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Citation worthiness check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page has readable text content.',
      };
    }
  },
};
