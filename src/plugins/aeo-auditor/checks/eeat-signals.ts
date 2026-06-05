/**
 * @module aeo-auditor/checks/eeat-signals
 * @description Evaluates E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals.
 *
 * Google and AI systems give preference to content that demonstrates
 * first-hand experience, subject-matter expertise, authoritativeness,
 * and trustworthiness. This check evaluates all four dimensions.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { aeoAuditorConfig } from '../config.js';

const CHECK_NAME = 'eeat-signals';
const cfg = aeoAuditorConfig.checks.eeatSignals;

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
 * Check for author information in JSON-LD and visible HTML.
 * @param html - Full page HTML.
 * @param blocks - Parsed JSON-LD objects.
 * @param metadata - Page metadata.
 * @returns Score from 0-100 for author information presence.
 */
function evaluateAuthorInfo(
  html: string,
  blocks: unknown[],
  metadata: { author?: string },
): number {
  let score = 0;

  /** Check metadata author. */
  if (metadata.author && metadata.author.trim().length > 0) {
    score += 25;
  }

  /** Check for author entity in JSON-LD. */
  const hasAuthorInJsonLd = blocks.some((block) => {
    if (block === null || typeof block !== 'object') return false;

    function walk(obj: unknown): boolean {
      if (obj === null || obj === undefined || typeof obj !== 'object') return false;
      if (Array.isArray(obj)) return obj.some((item) => walk(item));

      const record = obj as Record<string, unknown>;
      if (record['author'] !== undefined && record['author'] !== null) return true;
      return Object.values(record).some(
        (value) => typeof value === 'object' && value !== null && walk(value),
      );
    }

    return walk(block);
  });

  if (hasAuthorInJsonLd) score += 35;

  /** Check for visible author bio section in HTML. */
  const authorBioPatterns: RegExp[] = [
    /class\s*=\s*["'][^"']*author[^"']*["']/i,
    /id\s*=\s*["'][^"']*author[^"']*["']/i,
    /<(div|section|aside)[^>]*>[\s\S]*?about\s+the\s+author[\s\S]*?<\/\1>/i,
    /\bwritten\s+by\b/i,
    /\bauthor\s*:/i,
  ];

  const hasVisibleAuthor = authorBioPatterns.some((p) => p.test(html));
  if (hasVisibleAuthor) score += 40;

  return Math.min(100, score);
}

/**
 * Check for expertise markers in the content.
 * @param rawContent - Plain text content.
 * @param html - Full page HTML.
 * @returns Score from 0-100 for expertise signals.
 */
function evaluateExpertise(rawContent: string, html: string): number {
  let signals = 0;

  const expertisePatterns: RegExp[] = [
    /\byears?\s+of\s+experience\b/i,
    /\bcertified\b/i,
    /\bcredential/i,
    /\bqualified\b/i,
    /\bspeciali[sz]e/i,
    /\bexpert(ise)?\b/i,
    /\bprofessional\b/i,
    /\bdegree\s+in\b/i,
    /\bPh\.?D\.?\b/,
    /\bM\.?D\.?\b/,
    /\bMBA\b/,
    /\bM\.?S\.?\b/,
    /\bCPA\b/,
    /\bboard[- ]certified\b/i,
    /\blicensed\b/i,
  ];

  for (const pattern of expertisePatterns) {
    if (pattern.test(rawContent) || pattern.test(html)) {
      signals += 1;
    }
  }

  /** 2+ signals = full marks, 1 = partial. */
  if (signals >= 2) return 100;
  if (signals === 1) return 50;
  return 0;
}

/**
 * Check for experience indicators (first-hand experience).
 * @param rawContent - Plain text content.
 * @returns Score from 0-100 for experience signals.
 */
function evaluateExperience(rawContent: string): number {
  let signals = 0;

  const experiencePatterns: RegExp[] = [
    /\bI\s+tested\b/i,
    /\bin\s+my\s+experience\b/i,
    /\bI\s+(have\s+)?(used|tried|worked|built|created|developed|implemented)\b/i,
    /\bfirst[- ]?hand\b/i,
    /\bpersonally\b/i,
    /\bour\s+team\s+(tested|tried|used|built|developed)\b/i,
    /\bwe\s+(tested|tried|found|discovered|observed|noticed)\b/i,
    /\bfrom\s+(my|our)\s+testing\b/i,
    /\bhands[- ]on\b/i,
    /\breal[- ]world\s+(test|experience|use|application)\b/i,
  ];

  for (const pattern of experiencePatterns) {
    if (pattern.test(rawContent)) {
      signals += 1;
    }
  }

  if (signals >= 3) return 100;
  if (signals >= 2) return 75;
  if (signals === 1) return 40;
  return 0;
}

/**
 * Check for trust signals in the content.
 * @param rawContent - Plain text content.
 * @param html - Full page HTML.
 * @param metadata - Page metadata.
 * @returns Score from 0-100 for trust signals.
 */
function evaluateTrust(
  rawContent: string,
  html: string,
  metadata: { publishedAt?: string; updatedAt?: string },
): number {
  let score = 0;

  /** Check for cited sources. */
  const sourceCitationPatterns: RegExp[] = [
    /\baccording\s+to\b/i,
    /\bsource\s*:/i,
    /\bcited\b/i,
    /\breference/i,
    /\[\d+\]/,
  ];

  const hasSources = sourceCitationPatterns.some((p) => p.test(rawContent));
  if (hasSources) score += 30;

  /** Check for methodology description. */
  const methodologyPatterns: RegExp[] = [
    /\bmethodology\b/i,
    /\bhow\s+we\s+(tested|evaluated|reviewed|measured|analyzed)\b/i,
    /\bour\s+(approach|method|process|criteria)\b/i,
    /\btesting\s+(methodology|process|criteria)\b/i,
  ];

  const hasMethodology = methodologyPatterns.some((p) => p.test(rawContent));
  if (hasMethodology) score += 25;

  /** Check for dates (published/updated). */
  if (metadata.publishedAt || metadata.updatedAt) {
    score += 20;
  } else {
    /** Look for dates in the HTML. */
    const datePatterns: RegExp[] = [
      /<time[^>]*datetime/i,
      /\b(published|updated|modified|reviewed)\s*(on|:)?\s*\w+\s+\d{1,2},?\s+\d{4}/i,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
    ];

    const hasVisibleDates = datePatterns.some((p) => p.test(html));
    if (hasVisibleDates) score += 15;
  }

  /** Check for external links (citing sources). */
  const externalLinks = (html.match(/<a[^>]+href\s*=\s*["']https?:\/\/[^"']+["']/gi) || []).length;
  if (externalLinks >= 2) score += 25;
  else if (externalLinks >= 1) score += 12;

  return Math.min(100, score);
}

/**
 * AEO check: E-E-A-T Signals.
 *
 * Evaluates Experience, Expertise, Authoritativeness, and Trustworthiness
 * signals that AI systems use to determine content quality and citation priority.
 *
 * Scoring breakdown:
 * - 30 %: Author information (JSON-LD author entity, visible bio).
 * - 25 %: Expertise markers (credentials, qualifications, specialisation).
 * - 20 %: Experience indicators (first-person accounts, hands-on testing).
 * - 25 %: Trust signals (sources cited, methodology, dates, external links).
 */
export const eeatSignalsCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Evaluates E-E-A-T signals: author information, expertise markers, experience indicators, and trust signals.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const blocks = extractJsonLdBlocks(context.html);

      const authorScore = evaluateAuthorInfo(context.html, blocks, context.metadata);
      const expertiseScore = evaluateExpertise(context.rawContent, context.html);
      const experienceScore = evaluateExperience(context.rawContent);
      const trustScore = evaluateTrust(context.rawContent, context.html, context.metadata);

      const score = Math.round(
        authorScore * 0.30 +
        expertiseScore * 0.25 +
        experienceScore * 0.20 +
        trustScore * 0.25,
      );

      const passed = score >= 50;

      const issues: string[] = [];
      if (authorScore < 50) {
        issues.push('Author information is weak or missing.');
      }
      if (expertiseScore < 50) {
        issues.push('No expertise markers (credentials, qualifications) detected.');
      }
      if (experienceScore < 40) {
        issues.push('No first-hand experience indicators found.');
      }
      if (trustScore < 50) {
        issues.push('Trust signals (sources, methodology, dates) are insufficient.');
      }

      const message =
        issues.length === 0
          ? 'Strong E-E-A-T signals detected across all dimensions.'
          : `E-E-A-T issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (authorScore < 50) {
        fixParts.push(
          'Add author structured data (Person entity in JSON-LD) and a visible author bio section.',
        );
      }
      if (expertiseScore < 50) {
        fixParts.push('Include expertise markers such as credentials, certifications, or years of experience.');
      }
      if (experienceScore < 40) {
        fixParts.push(
          'Add first-person experience indicators like "I tested", "in my experience", or "hands-on".',
        );
      }
      if (trustScore < 50) {
        fixParts.push(
          'Cite sources, describe your methodology, include publication dates, and link to authoritative references.',
        );
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          authorInfoScore: authorScore,
          expertiseScore,
          experienceScore,
          trustScore,
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
        message: `E-E-A-T signals check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML and JSON-LD structured data.',
      };
    }
  },
};
