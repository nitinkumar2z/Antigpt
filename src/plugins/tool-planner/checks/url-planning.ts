/**
 * @module tool-planner/checks/url-planning
 * @description Validates the URL structure of a tool page for SEO compliance.
 *
 * Evaluates four dimensions of URL quality:
 * 1. **Slug length** – the URL slug must not exceed a configurable maximum
 *    (default 60 characters).
 * 2. **SEO-friendly format** – lowercase, hyphen-separated, no underscores,
 *    no special characters, no consecutive hyphens.
 * 3. **Keyword presence** – at least one tag keyword appears in the slug.
 * 4. **URL depth** – path should be at most 3 levels deep
 *    (e.g. `/tools/category/tool-name`).
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { toolPlannerConfig } from '../config.js';

const CONFIG = toolPlannerConfig.checks.urlPlanning;

// ---------------------------------------------------------------------------
// Slug extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the path portion from a URL string, stripping the origin, query
 * string, and fragment.
 *
 * @param url - A fully-qualified URL string.
 * @returns The pathname (e.g. `/tools/seo/keyword-planner`), or `/` on parse failure.
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // Fallback: strip query/fragment and return as-is
    const cleaned = url.split('?')[0].split('#')[0];
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }
}

/**
 * Extracts the last segment (slug) from a URL pathname.
 *
 * @param pathname - The URL pathname (e.g. `/tools/seo/keyword-planner`).
 * @returns The final slug segment, or an empty string for the root path.
 */
function extractSlug(pathname: string): string {
  const withoutTrailing = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const segments = withoutTrailing.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : '';
}

/**
 * Counts the depth of a URL path by counting non-empty segments.
 *
 * @param pathname - The URL pathname.
 * @returns The depth as a positive integer (root `/` = 0).
 */
function getPathDepth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Format validation
// ---------------------------------------------------------------------------

/** Pattern matching a well-formed SEO slug: lowercase alphanumeric with hyphens. */
const SEO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pattern detecting uppercase characters. */
const HAS_UPPERCASE = /[A-Z]/;

/** Pattern detecting underscores. */
const HAS_UNDERSCORES = /_/;

/** Pattern detecting special characters that are not alphanumeric or hyphens. */
const HAS_SPECIAL_CHARS = /[^a-zA-Z0-9\-/]/;

/** Pattern detecting consecutive hyphens. */
const HAS_CONSECUTIVE_HYPHENS = /--+/;

/**
 * Evaluates the SEO-friendliness of a slug and collects format issues.
 *
 * @param slug - The URL slug to evaluate.
 * @returns An object with `score` (0–25) and an array of issue descriptions.
 */
function evaluateSlugFormat(slug: string): { score: number; issues: string[] } {
  if (slug.length === 0) {
    return { score: 0, issues: ['Slug is empty; every tool page needs a descriptive URL slug.'] };
  }

  if (SEO_SLUG_PATTERN.test(slug)) {
    return { score: 25, issues: [] };
  }

  const issues: string[] = [];
  let deductions = 0;

  if (HAS_UPPERCASE.test(slug)) {
    issues.push('Slug contains uppercase characters; use lowercase only.');
    deductions += 8;
  }

  if (HAS_UNDERSCORES.test(slug)) {
    issues.push('Slug contains underscores; use hyphens instead.');
    deductions += 8;
  }

  if (HAS_SPECIAL_CHARS.test(slug)) {
    issues.push('Slug contains special characters; use only lowercase letters, numbers, and hyphens.');
    deductions += 8;
  }

  if (HAS_CONSECUTIVE_HYPHENS.test(slug)) {
    issues.push('Slug contains consecutive hyphens; use single hyphens.');
    deductions += 5;
  }

  return { score: Math.max(0, 25 - deductions), issues };
}

// ---------------------------------------------------------------------------
// Keyword matching
// ---------------------------------------------------------------------------

/**
 * Checks whether at least one metadata tag keyword appears within the slug.
 *
 * Multi-word keywords are normalised to hyphenated form for comparison
 * (e.g. "keyword planner" → "keyword-planner").
 *
 * @param slug - The URL slug.
 * @param tags - Array of keyword tags from page metadata.
 * @returns `true` if at least one tag appears in the slug.
 */
function slugContainsKeyword(slug: string, tags: readonly string[]): boolean {
  const lowerSlug = slug.toLowerCase();
  return tags.some((tag) => {
    const normalised = tag.toLowerCase().trim().replace(/\s+/g, '-');
    return normalised.length > 0 && lowerSlug.includes(normalised);
  });
}

// ---------------------------------------------------------------------------
// Check implementation
// ---------------------------------------------------------------------------

/**
 * URL planning check for tool pages.
 *
 * Validates that the page URL follows SEO best practices for programmatic
 * tool pages, ensuring short slugs, clean formatting, keyword inclusion,
 * and a shallow path hierarchy.
 *
 * Scoring breakdown (each component scaled to its weight, totalling 0–100):
 * - **Slug length (25%)**: Slug is within the configured character limit.
 * - **SEO-friendly format (25%)**: Lowercase, hyphens, no special characters.
 * - **Keyword in slug (25%)**: At least one tag keyword appears in the slug.
 * - **URL depth (25%)**: Path is at most 3 levels deep.
 *
 * @see toolPlannerConfig.checks.urlPlanning
 */
export const urlPlanningCheck: PluginCheck = {
  name: 'url-planning',
  description:
    'Validates URL structure for SEO including slug length, format, keyword presence, and path depth.',
  severity: 'critical',
  weight: CONFIG.weight,

  /**
   * Executes the URL planning check against the supplied context.
   *
   * @param context - The page / site context to evaluate.
   * @returns A promise resolving to the structured check result. Never throws.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { url, metadata } = context;
      const pathname = extractPath(url);
      const slug = metadata.slug || extractSlug(pathname);
      const depth = getPathDepth(pathname);
      const issues: string[] = [];

      /* ---------- Slug length (25 pts) ---------- */
      let lengthScore: number;

      if (slug.length === 0) {
        lengthScore = 0;
        issues.push('No slug found; tool pages require a descriptive URL slug.');
      } else if (slug.length <= CONFIG.maxSlugLength) {
        lengthScore = 25;
      } else {
        const overshoot = slug.length - CONFIG.maxSlugLength;
        lengthScore = Math.max(0, 25 - Math.round((overshoot / CONFIG.maxSlugLength) * 25));
        issues.push(
          `Slug is ${slug.length} chars; maximum recommended is ${CONFIG.maxSlugLength}.`,
        );
      }

      /* ---------- SEO-friendly format (25 pts) ---------- */
      const formatResult = evaluateSlugFormat(slug);
      const formatScore = formatResult.score;
      issues.push(...formatResult.issues);

      /* ---------- Keyword in slug (25 pts) ---------- */
      let keywordScore: number;
      const tags = metadata.tags ?? [];

      if (slug.length === 0) {
        keywordScore = 0;
      } else if (tags.length === 0) {
        // No tags to compare against — grant partial credit.
        keywordScore = 15;
        issues.push('No tags available in metadata to verify keyword presence in slug.');
      } else if (slugContainsKeyword(slug, tags)) {
        keywordScore = 25;
      } else {
        keywordScore = 0;
        issues.push(
          `Slug "${slug}" does not contain any of the page keyword tags [${tags.join(', ')}].`,
        );
      }

      /* ---------- URL depth (25 pts) ---------- */
      let depthScore: number;

      if (depth <= 3) {
        depthScore = 25;
      } else if (depth === 4) {
        depthScore = 15;
        issues.push(
          `URL is ${depth} levels deep; recommended maximum is 3 (e.g. /tools/category/tool-name).`,
        );
      } else {
        depthScore = Math.max(0, 25 - (depth - 3) * 8);
        issues.push(
          `URL is ${depth} levels deep; strongly recommended maximum is 3 levels.`,
        );
      }

      const totalScore = lengthScore + formatScore + keywordScore + depthScore;
      const passed = totalScore >= toolPlannerConfig.threshold;

      return {
        checkName: 'url-planning',
        score: totalScore,
        passed,
        severity: 'critical',
        message:
          issues.length === 0
            ? 'URL structure passes all SEO checks.'
            : issues.join(' '),
        details: {
          url,
          pathname,
          slug,
          slugLength: slug.length,
          maxSlugLength: CONFIG.maxSlugLength,
          depth,
          lengthScore,
          formatScore,
          keywordScore,
          depthScore,
          tags,
        },
        fixSuggestion:
          totalScore < 100
            ? `Ensure the slug is under ${CONFIG.maxSlugLength} characters, uses only lowercase letters/numbers/hyphens, contains a target keyword, and the URL is at most 3 levels deep.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'url-planning',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `URL planning check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the URL and metadata — the URL planning check encountered an internal error.',
      };
    }
  },
};
