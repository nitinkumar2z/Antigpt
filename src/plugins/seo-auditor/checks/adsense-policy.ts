/**
 * @module seo-auditor/checks/adsense-policy
 * @description Validates AdSense policy compliance for programmatic SEO pages.
 * Checks word count, content-to-ad ratio, legal page links, and content quality.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.adsensePolicy;

/**
 * Patterns that identify ad-related HTML elements.
 * Used to estimate ad density relative to total page content.
 */
const AD_PATTERNS: readonly RegExp[] = [
  /<ins\s+[^>]*class\s*=\s*["'][^"']*adsbygoogle[^"']*["'][^>]*>/gi,
  /<div\s+[^>]*(?:id|class)\s*=\s*["'][^"']*(?:ad[s\-_]?|advertisement|sponsor|banner-ad|google[_-]?ad)[^"']*["'][^>]*>/gi,
  /<amp-ad\b[^>]*>/gi,
  /<iframe\s+[^>]*(?:googlesyndication|doubleclick|ad\.)[^>]*>/gi,
];

/**
 * Link text patterns for legal / policy pages that AdSense requires.
 */
const LEGAL_PAGE_PATTERNS: readonly RegExp[] = [
  /privacy\s*policy/i,
  /terms\s*(?:of\s*(?:service|use)|&\s*conditions|and\s*conditions)/i,
  /cookie\s*policy/i,
  /disclaimer/i,
];

/**
 * Counts the approximate number of ad-related elements in the HTML.
 *
 * @param html - Full HTML source string.
 * @returns Count of detected ad elements.
 */
function countAdElements(html: string): number {
  let count = 0;
  for (const pattern of AD_PATTERNS) {
    // Reset lastIndex for global regexes.
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = html.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Counts the total number of content block elements (paragraphs, headings, lists).
 *
 * @param html - Full HTML source string.
 * @returns Count of content block elements.
 */
function countContentBlocks(html: string): number {
  const matches = html.match(/<(?:p|h[1-6]|li|blockquote|pre|td)\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

/**
 * Checks whether the HTML contains links to required legal pages.
 *
 * @param html - Full HTML source string.
 * @returns Object with found and missing legal page categories.
 */
function checkLegalPages(html: string): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];
  const labels = ['Privacy Policy', 'Terms of Service'];

  for (let i = 0; i < LEGAL_PAGE_PATTERNS.length && i < 2; i++) {
    if (LEGAL_PAGE_PATTERNS[i].test(html)) {
      found.push(labels[i]);
    } else {
      missing.push(labels[i]);
    }
  }

  return { found, missing };
}

/**
 * Calculates a sentence variety score to detect thin/auto-generated content.
 * Measures the ratio of unique sentence lengths to total sentences.
 * A low ratio suggests repetitive, template-generated content.
 *
 * @param rawContent - The raw text content of the page.
 * @returns Variety ratio between 0 and 1. Higher is better.
 */
function calculateSentenceVariety(rawContent: string): number {
  const sentences = rawContent
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length < 3) {
    return 0;
  }

  const lengths = sentences.map((s) => {
    // Bucket lengths to nearest 5 for fuzzy uniqueness.
    const wordCount = s.split(/\s+/).length;
    return Math.round(wordCount / 3) * 3;
  });

  const uniqueLengths = new Set(lengths);
  return uniqueLengths.size / lengths.length;
}

/**
 * PluginCheck that validates AdSense policy compliance for programmatic SEO.
 *
 * Scoring breakdown:
 * - **Word count (30%)**: Minimum content word count (default 300).
 * - **Content ratio (25%)**: Ad elements are below maxAdDensity threshold.
 * - **Legal pages (20%)**: Privacy Policy and Terms of Service links present.
 * - **Content quality (25%)**: Sentence variety suggests non-auto-generated content.
 *
 * @see seoAuditorConfig.checks.adsensePolicy
 */
export const adsensePolicyCheck: PluginCheck = {
  name: 'adsense-policy',
  description:
    'Validates AdSense eligibility: minimum word count, content-to-ad ratio, legal page links, and content quality.',
  severity: 'critical',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, rawContent, metadata } = context;
      const issues: string[] = [];

      /* ---------- Word count (30 pts) ---------- */
      let wordCountScore = 0;
      const wordCount = metadata.wordCount;
      if (wordCount >= CONFIG.minWordCount) {
        wordCountScore = 30;
      } else if (wordCount > 0) {
        wordCountScore = Math.round((wordCount / CONFIG.minWordCount) * 30);
        issues.push(
          `Word count is ${wordCount}; AdSense requires substantive content (minimum ${CONFIG.minWordCount} words recommended).`,
        );
      } else {
        issues.push('Page has no detectable content. AdSense requires substantial original content.');
      }

      /* ---------- Content ratio (25 pts) ---------- */
      let contentRatioScore = 0;
      const adCount = countAdElements(html);
      const contentBlockCount = countContentBlocks(html);
      const totalElements = adCount + contentBlockCount;

      if (totalElements === 0) {
        // No ads and no content blocks — not relevant.
        contentRatioScore = 25;
      } else {
        const adDensity = adCount / totalElements;
        if (adDensity <= CONFIG.maxAdDensity) {
          contentRatioScore = 25;
        } else {
          const excess = adDensity - CONFIG.maxAdDensity;
          const penalty = Math.min(25, Math.round((excess / CONFIG.maxAdDensity) * 25));
          contentRatioScore = Math.max(0, 25 - penalty);
          issues.push(
            `Ad density is ${Math.round(adDensity * 100)}% (${adCount} ad elements vs ${contentBlockCount} content blocks); maximum allowed is ${Math.round(CONFIG.maxAdDensity * 100)}%.`,
          );
        }
      }

      /* ---------- Legal pages (20 pts) ---------- */
      let legalScore = 0;
      const legal = checkLegalPages(html);
      if (legal.missing.length === 0) {
        legalScore = 20;
      } else {
        const foundRatio = legal.found.length / (legal.found.length + legal.missing.length);
        legalScore = Math.round(foundRatio * 20);
        issues.push(
          `Missing links to required legal pages: ${legal.missing.join(', ')}. AdSense requires these.`,
        );
      }

      /* ---------- Content quality (25 pts) ---------- */
      let qualityScore = 0;
      const variety = calculateSentenceVariety(rawContent);
      if (variety >= 0.5) {
        qualityScore = 25;
      } else if (variety > 0.2) {
        qualityScore = Math.round((variety / 0.5) * 25);
        issues.push(
          `Sentence variety is low (${Math.round(variety * 100)}%). Content may appear auto-generated.`,
        );
      } else if (rawContent.trim().length > 0) {
        qualityScore = 5;
        issues.push(
          `Sentence variety is very low (${Math.round(variety * 100)}%). Content appears thin or auto-generated.`,
        );
      } else {
        issues.push('No raw content available for quality analysis.');
      }

      const totalScore = wordCountScore + contentRatioScore + legalScore + qualityScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'adsense-policy',
        score: totalScore,
        passed,
        severity: 'critical',
        message:
          issues.length === 0
            ? 'AdSense policy compliance passes all checks.'
            : issues.join(' '),
        details: {
          wordCount,
          minWordCount: CONFIG.minWordCount,
          adElementCount: adCount,
          contentBlockCount,
          adDensity: totalElements > 0 ? Math.round((adCount / totalElements) * 100) : 0,
          legalPagesFound: legal.found,
          legalPagesMissing: legal.missing,
          sentenceVariety: Math.round(variety * 100),
          wordCountScore,
          contentRatioScore,
          legalScore,
          qualityScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Ensure at least ${CONFIG.minWordCount} words of original content, keep ad density below ${Math.round(CONFIG.maxAdDensity * 100)}%, link to Privacy Policy and Terms, and write varied sentences.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'adsense-policy',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `AdSense policy check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the page content — the AdSense policy check encountered an internal error.',
      };
    }
  },
};
