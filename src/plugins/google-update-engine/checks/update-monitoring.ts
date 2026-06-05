/**
 * @fileoverview Update monitoring check for the Google Update Engine plugin.
 *
 * Monitors Google update resilience signals by evaluating content against
 * four scoring dimensions:
 *
 * - **Search Essentials** (30%): Unique title, meta description, proper heading hierarchy.
 * - **Helpful Content** (30%): First-person expertise markers, original data, comprehensive coverage.
 * - **Spam Policy** (20%): No keyword stuffing (density < 3%), no hidden text patterns.
 * - **Quality Signals** (20%): E-E-A-T markers — author attribution, dates, cited sources.
 *
 * All analysis is performed locally against the HTML and raw content
 * without external network calls.
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { googleUpdateEngineConfig } from '../config.js';

const config = googleUpdateEngineConfig.checks.updateMonitoring;

/** Regex to extract the content of the `<title>` tag. */
const TITLE_TAG_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;

/** Regex to extract the content attribute of the meta description. */
const META_DESC_REGEX =
  /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i;

/** Alternate meta description pattern (content before name). */
const META_DESC_REGEX_ALT =
  /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i;

/** Regex to match all heading tags (h1–h6). */
const HEADING_REGEX = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

/** First-person expertise markers indicating original knowledge. */
const EXPERTISE_MARKERS = [
  /\bi (?:found|discovered|tested|observed|measured|built|created|developed|analyzed|researched)\b/i,
  /\b(?:in my experience|based on my|from my research|our team|our data|our analysis|we found|we tested)\b/i,
  /\b(?:according to our|our findings|my recommendation|i recommend)\b/i,
];

/** Patterns indicating original data or research. */
const ORIGINAL_DATA_MARKERS = [
  /\b(?:survey|study|experiment|analysis) (?:of|with|involving) \d+/i,
  /\b(?:we surveyed|we analyzed|we collected|we measured|data from|results show)\b/i,
  /<(?:table|figure|chart)/i,
  /\b\d+(?:\.\d+)?%\b/,
];

/** Patterns indicating hidden text (display:none or visibility:hidden with keyword-rich content). */
const HIDDEN_TEXT_REGEX =
  /(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|color\s*:\s*(?:transparent|rgba\([^)]*,\s*0\)))[^"']*>[^<]{20,}/gi;

/** Regex to strip HTML tags for plain-text extraction. */
const STRIP_TAGS_REGEX = /<[^>]+>/g;

/** Regex to split text into words. */
const WORD_SPLIT_REGEX = /\s+/;

/** E-E-A-T author attribution patterns. */
const AUTHOR_PATTERNS = [
  /<meta\s[^>]*name\s*=\s*["']author["'][^>]*>/i,
  /(?:written by|authored by|by)\s+[A-Z][a-z]+/i,
  /class\s*=\s*["'][^"']*author[^"']*["']/i,
  /"author"\s*:/i,
];

/** Date patterns for freshness signals. */
const DATE_PATTERNS = [
  /<time[^>]*datetime\s*=\s*["'][^"']+["'][^>]*>/i,
  /(?:published|updated|modified|reviewed)\s*(?:on|:)\s*\w+\s+\d{1,2},?\s+\d{4}/i,
  /"datePublished"\s*:/i,
  /"dateModified"\s*:/i,
];

/** Source citation patterns. */
const SOURCE_PATTERNS = [
  /(?:according to|source:|cited in|reference:|references:)/i,
  /<a[^>]+href\s*=\s*["']https?:\/\/[^"']+["'][^>]*>.*?(?:source|study|research|report)/i,
  /\[\d+\]/,
  /<(?:cite|blockquote)[^>]*>/i,
];

/**
 * Extract plain text from HTML by stripping all tags.
 *
 * @param html - The HTML string to strip.
 * @returns Plain text with tags removed and whitespace normalised.
 */
function stripHtml(html: string): string {
  return html.replace(STRIP_TAGS_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract all words from a text string.
 *
 * @param text - The plain-text string to tokenise.
 * @returns Array of lowercase, non-empty word tokens.
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT_REGEX)
    .map((w) => w.replace(/[^a-z'-]/g, ''))
    .filter((w) => w.length > 1);
}

/**
 * Compute keyword density for the most frequent non-stopword term.
 *
 * Skips common English stop words to avoid false positives on articles,
 * prepositions, and conjunctions.
 *
 * @param words - Array of lowercase word tokens.
 * @returns The highest single-keyword density as a fraction (0–1).
 */
function computeMaxKeywordDensity(words: string[]): number {
  if (words.length === 0) {
    return 0;
  }

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
    'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'our', 'their', 'not', 'no', 'if', 'then', 'than', 'so', 'up',
    'out', 'about', 'into', 'over', 'after', 'before', 'between',
  ]);

  const freq = new Map<string, number>();
  let filteredCount = 0;

  for (const word of words) {
    if (stopWords.has(word)) {
      continue;
    }
    filteredCount++;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  if (filteredCount === 0) {
    return 0;
  }

  let maxCount = 0;
  for (const count of freq.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  return maxCount / words.length;
}

/**
 * Evaluate Search Essentials compliance.
 *
 * Checks for unique title tag, meta description, and proper heading hierarchy
 * (exactly one H1, headings don't skip levels).
 *
 * @param html     - The page HTML.
 * @param metadata - The page metadata from context.
 * @returns Score between 0 and 100 and a list of issues found.
 */
function evaluateSearchEssentials(
  html: string,
  metadata: { title: string; description: string },
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let points = 0;
  const maxPoints = 4;

  // 1. Unique title tag present and non-empty
  const titleMatch = TITLE_TAG_REGEX.exec(html);
  const titleContent = titleMatch ? titleMatch[1].trim() : '';
  if (titleContent.length > 0 && titleContent.length <= 70) {
    points++;
  } else if (titleContent.length === 0) {
    issues.push('Missing or empty <title> tag');
  } else {
    issues.push(`Title tag is too long (${titleContent.length} chars; recommended ≤ 70)`);
    points += 0.5;
  }

  // 2. Meta description present and within recommended length
  const descMatch = META_DESC_REGEX.exec(html) ?? META_DESC_REGEX_ALT.exec(html);
  const descContent = descMatch ? descMatch[1].trim() : '';
  if (descContent.length >= 50 && descContent.length <= 160) {
    points++;
  } else if (descContent.length > 0) {
    issues.push(`Meta description length (${descContent.length}) outside 50–160 char range`);
    points += 0.5;
  } else {
    issues.push('Missing meta description');
  }

  // 3. Exactly one H1 tag
  const headings: Array<{ level: number; text: string }> = [];
  HEADING_REGEX.lastIndex = 0;
  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = HEADING_REGEX.exec(html)) !== null) {
    headings.push({
      level: parseInt(headingMatch[1], 10),
      text: stripHtml(headingMatch[2]).trim(),
    });
  }

  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count === 1) {
    points++;
  } else if (h1Count === 0) {
    issues.push('No H1 heading found');
  } else {
    issues.push(`Multiple H1 headings found (${h1Count}); use exactly one`);
    points += 0.5;
  }

  // 4. Proper heading hierarchy (no level skips)
  let hierarchyValid = true;
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      hierarchyValid = false;
      issues.push(`Heading hierarchy skips from H${prev} to H${curr}`);
      break;
    }
  }
  if (hierarchyValid && headings.length > 0) {
    points++;
  }

  return {
    score: Math.round((points / maxPoints) * 100),
    issues,
  };
}

/**
 * Evaluate Helpful Content signals.
 *
 * Checks for first-person expertise markers, original data references,
 * and comprehensive coverage (word count relative to topic depth).
 *
 * @param rawContent - The raw (pre-rendered) content.
 * @param html       - The page HTML.
 * @param wordCount  - Total word count from metadata.
 * @returns Score between 0 and 100 and a list of issues found.
 */
function evaluateHelpfulContent(
  rawContent: string,
  html: string,
  wordCount: number,
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let points = 0;
  const maxPoints = 3;

  // 1. First-person expertise markers
  const combinedText = rawContent + ' ' + stripHtml(html);
  const expertiseHits = EXPERTISE_MARKERS.filter((pattern) => pattern.test(combinedText)).length;
  if (expertiseHits >= 2) {
    points++;
  } else if (expertiseHits === 1) {
    points += 0.5;
    issues.push('Limited first-person expertise markers; add more original insights');
  } else {
    issues.push('No first-person expertise markers found; content may lack demonstrable experience');
  }

  // 2. Original data references
  const dataHits = ORIGINAL_DATA_MARKERS.filter((pattern) => pattern.test(combinedText)).length;
  if (dataHits >= 2) {
    points++;
  } else if (dataHits === 1) {
    points += 0.5;
    issues.push('Limited original data; consider adding more data points or research');
  } else {
    issues.push('No original data or research signals detected');
  }

  // 3. Comprehensive coverage (word count as a proxy)
  if (wordCount >= 1500) {
    points++;
  } else if (wordCount >= 800) {
    points += 0.7;
    issues.push(`Content depth is moderate (${wordCount} words); consider expanding to 1500+`);
  } else if (wordCount >= 300) {
    points += 0.3;
    issues.push(`Content is thin (${wordCount} words); expand to at least 800 words for depth`);
  } else {
    issues.push(`Content is very thin (${wordCount} words); significantly expand coverage`);
  }

  return {
    score: Math.round((points / maxPoints) * 100),
    issues,
  };
}

/**
 * Evaluate spam policy compliance.
 *
 * Checks for keyword stuffing (density above 3%) and hidden text patterns
 * (display:none or visibility:hidden containing keyword-rich text).
 *
 * @param html       - The page HTML.
 * @param rawContent - The raw content.
 * @returns Score between 0 and 100 and a list of issues found.
 */
function evaluateSpamCompliance(
  html: string,
  rawContent: string,
): { score: number; issues: string[]; maxDensity: number } {
  const issues: string[] = [];
  let points = 0;
  const maxPoints = 2;

  // 1. Keyword density check
  const plainText = stripHtml(html) + ' ' + rawContent;
  const words = extractWords(plainText);
  const maxDensity = computeMaxKeywordDensity(words);
  const densityPercent = Math.round(maxDensity * 10000) / 100;

  if (maxDensity < 0.03) {
    points++;
  } else if (maxDensity < 0.05) {
    points += 0.5;
    issues.push(`Borderline keyword density (${densityPercent}%); target below 3%`);
  } else {
    issues.push(`High keyword density (${densityPercent}%) indicates potential keyword stuffing`);
  }

  // 2. Hidden text check
  HIDDEN_TEXT_REGEX.lastIndex = 0;
  const hiddenTextMatches = html.match(HIDDEN_TEXT_REGEX);
  if (!hiddenTextMatches || hiddenTextMatches.length === 0) {
    points++;
  } else {
    issues.push(`${hiddenTextMatches.length} hidden text pattern(s) detected; may violate spam policy`);
  }

  return {
    score: Math.round((points / maxPoints) * 100),
    issues,
    maxDensity: densityPercent,
  };
}

/**
 * Evaluate E-E-A-T quality signals.
 *
 * Checks for author attribution, date signals (published/updated),
 * and source citations.
 *
 * @param html       - The page HTML.
 * @param rawContent - The raw content.
 * @param metadata   - Page metadata for supplemental date/author info.
 * @returns Score between 0 and 100 and a list of issues found.
 */
function evaluateQualitySignals(
  html: string,
  rawContent: string,
  metadata: { author?: string; publishedAt?: string; updatedAt?: string },
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let points = 0;
  const maxPoints = 3;
  const combinedContent = html + ' ' + rawContent;

  // 1. Author attribution
  const hasAuthorMeta = metadata.author != null && metadata.author.length > 0;
  const hasAuthorHtml = AUTHOR_PATTERNS.some((p) => p.test(combinedContent));
  if (hasAuthorMeta || hasAuthorHtml) {
    points++;
  } else {
    issues.push('No author attribution found; add author name for E-E-A-T compliance');
  }

  // 2. Date signals
  const hasDateMeta =
    (metadata.publishedAt != null && metadata.publishedAt.length > 0) ||
    (metadata.updatedAt != null && metadata.updatedAt.length > 0);
  const hasDateHtml = DATE_PATTERNS.some((p) => p.test(combinedContent));
  if (hasDateMeta || hasDateHtml) {
    points++;
  } else {
    issues.push('No publication or update date found; add dates for freshness signals');
  }

  // 3. Source citations
  const sourceHits = SOURCE_PATTERNS.filter((p) => p.test(combinedContent)).length;
  if (sourceHits >= 2) {
    points++;
  } else if (sourceHits === 1) {
    points += 0.5;
    issues.push('Limited source citations; add more references for credibility');
  } else {
    issues.push('No source citations found; cite authoritative sources for trustworthiness');
  }

  return {
    score: Math.round((points / maxPoints) * 100),
    issues,
  };
}

/**
 * Update monitoring plugin check.
 *
 * Evaluates content resilience against Google algorithm updates by
 * analysing compliance with Search Essentials, Helpful Content guidelines,
 * spam policies, and E-E-A-T quality signals. Each dimension contributes
 * a weighted portion to the composite score.
 */
export const updateMonitoringCheck: PluginCheck = {
  name: 'update-monitoring',
  description:
    'Monitors Google update resilience by checking Search Essentials compliance, ' +
    'Helpful Content signals, spam policy adherence, and E-E-A-T quality markers.',
  severity: 'critical',
  weight: config.weight,

  /**
   * Execute the update monitoring check against the provided context.
   *
   * @param context - The check context containing HTML, raw content, and metadata.
   * @returns A CheckResult with the resilience score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'update-monitoring';

    try {
      const { html, rawContent, metadata } = context;

      // Edge case: no content available
      if ((!html || html.trim().length === 0) && (!rawContent || rawContent.trim().length === 0)) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No content available for update monitoring analysis.',
          details: {
            searchEssentials: 0,
            helpfulContent: 0,
            spamCompliance: 0,
            qualitySignals: 0,
          },
          fixSuggestion: 'Add HTML and raw content to enable Google update resilience analysis.',
        };
      }

      // Evaluate each dimension
      const searchEssentials = evaluateSearchEssentials(html, metadata);
      const helpfulContent = evaluateHelpfulContent(rawContent, html, metadata.wordCount);
      const spamCompliance = evaluateSpamCompliance(html, rawContent);
      const qualitySignals = evaluateQualitySignals(html, rawContent, metadata);

      // Weighted composite: search-essentials 30%, helpful-content 30%, spam 20%, quality 20%
      const score = Math.round(
        searchEssentials.score * 0.3 +
        helpfulContent.score * 0.3 +
        spamCompliance.score * 0.2 +
        qualitySignals.score * 0.2,
      );

      const passed = score >= 60;

      // Aggregate all issues
      const allIssues = [
        ...searchEssentials.issues,
        ...helpfulContent.issues,
        ...spamCompliance.issues,
        ...qualitySignals.issues,
      ];

      // Build human-readable message
      let message: string;
      if (score >= 90) {
        message = `Content shows strong Google update resilience (score: ${score}/100).`;
      } else if (score >= 60) {
        message = `Content has moderate Google update resilience (score: ${score}/100). ${allIssues.length} issue(s) found.`;
      } else {
        message = `Content is vulnerable to Google algorithm updates (score: ${score}/100). ${allIssues.length} issue(s) require attention.`;
      }

      const result: CheckResult = {
        checkName,
        score,
        passed,
        severity: 'critical',
        message,
        details: {
          searchEssentialsScore: searchEssentials.score,
          helpfulContentScore: helpfulContent.score,
          spamComplianceScore: spamCompliance.score,
          qualitySignalsScore: qualitySignals.score,
          maxKeywordDensity: spamCompliance.maxDensity,
          issues: allIssues,
          issueCount: allIssues.length,
        },
      };

      if (!passed) {
        const suggestions: string[] = [];
        if (searchEssentials.score < 75) {
          suggestions.push(
            'Ensure a unique <title>, meta description (50–160 chars), one H1, and proper heading hierarchy.',
          );
        }
        if (helpfulContent.score < 75) {
          suggestions.push(
            'Add first-person expertise, original data, and expand content depth to 1500+ words.',
          );
        }
        if (spamCompliance.score < 75) {
          suggestions.push(
            'Reduce keyword density below 3% and remove any hidden text patterns.',
          );
        }
        if (qualitySignals.score < 75) {
          suggestions.push(
            'Add author attribution, publication/update dates, and cite authoritative sources.',
          );
        }
        result.fixSuggestion = suggestions.join(' ');
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during update monitoring analysis';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Update monitoring check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the content contains valid HTML.',
      };
    }
  },
};
