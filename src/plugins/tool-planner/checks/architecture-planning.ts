/**
 * @module tool-planner/checks/architecture-planning
 * @description Validates the front-end architecture of a tool page.
 *
 * Evaluates four signals of a well-planned tool page architecture:
 * 1. **Semantic structure** – uses `<main>`, `<article>`, `<section>`, `<nav>`,
 *    `<aside>`, `<header>`, or `<footer>` elements.
 * 2. **Progressive enhancement** – works without JavaScript via `<noscript>`
 *    fallbacks and server-rendered content before script tags.
 * 3. **Accessibility foundations** – includes `<label>` elements, `aria-*`
 *    attributes, and `role` attributes.
 * 4. **Responsive design indicators** – has viewport meta tag, `srcset` on
 *    images, and `<picture>` elements.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { toolPlannerConfig } from '../config.js';

const CONFIG = toolPlannerConfig.checks.architecturePlanning;

// ---------------------------------------------------------------------------
// Semantic structure helpers
// ---------------------------------------------------------------------------

/**
 * Regular expressions that detect key semantic HTML5 elements.
 * Each pattern matches the opening tag (self-closing or not).
 */
const SEMANTIC_PATTERNS: ReadonlyMap<string, RegExp> = new Map([
  ['main', /<main[\s>]/i],
  ['article', /<article[\s>]/i],
  ['section', /<section[\s>]/i],
  ['nav', /<nav[\s>]/i],
  ['aside', /<aside[\s>]/i],
  ['header', /<header[\s>]/i],
  ['footer', /<footer[\s>]/i],
]);

/**
 * Counts how many distinct semantic landmark elements appear in the HTML.
 *
 * @param html - The full HTML source string.
 * @returns The count of unique semantic elements found (0–7).
 */
function countSemanticElements(html: string): number {
  let count = 0;
  for (const [, pattern] of SEMANTIC_PATTERNS) {
    if (pattern.test(html)) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Progressive enhancement helpers
// ---------------------------------------------------------------------------

/**
 * Checks for the presence of `<noscript>` fallback content.
 *
 * @param html - The full HTML source string.
 * @returns `true` if at least one `<noscript>` block exists.
 */
function hasNoscriptFallback(html: string): boolean {
  return /<noscript[\s>]/i.test(html);
}

/**
 * Determines whether meaningful server-rendered content precedes the first
 * `<script>` tag. Meaningful content is defined as at least 200 characters
 * of non-whitespace text inside the `<body>`.
 *
 * @param html - The full HTML source string.
 * @returns `true` if server-rendered content appears before the first script.
 */
function hasServerRenderedContentBeforeScripts(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)/i);
  if (!bodyMatch) {
    return false;
  }
  const bodyContent = bodyMatch[1];
  const firstScript = bodyContent.search(/<script[\s>]/i);
  const contentBefore = firstScript === -1 ? bodyContent : bodyContent.slice(0, firstScript);
  const textOnly = contentBefore.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return textOnly.length >= 200;
}

// ---------------------------------------------------------------------------
// Accessibility helpers
// ---------------------------------------------------------------------------

/** Pattern matching `<label` opening tags. */
const LABEL_PATTERN = /<label[\s>]/gi;

/** Pattern matching any `aria-` attribute. */
const ARIA_PATTERN = /\baria-[\w-]+\s*=/gi;

/** Pattern matching any `role` attribute. */
const ROLE_PATTERN = /\brole\s*=/gi;

/**
 * Evaluates accessibility foundation signals in the HTML.
 *
 * @param html - The full HTML source string.
 * @returns An object with boolean flags for each signal and total count.
 */
function evaluateAccessibility(html: string): {
  hasLabels: boolean;
  hasAriaAttributes: boolean;
  hasRoleAttributes: boolean;
  signalCount: number;
} {
  const hasLabels = LABEL_PATTERN.test(html);
  // Reset lastIndex after test() with /g flag
  LABEL_PATTERN.lastIndex = 0;

  const hasAriaAttributes = ARIA_PATTERN.test(html);
  ARIA_PATTERN.lastIndex = 0;

  const hasRoleAttributes = ROLE_PATTERN.test(html);
  ROLE_PATTERN.lastIndex = 0;

  let signalCount = 0;
  if (hasLabels) signalCount++;
  if (hasAriaAttributes) signalCount++;
  if (hasRoleAttributes) signalCount++;

  return { hasLabels, hasAriaAttributes, hasRoleAttributes, signalCount };
}

// ---------------------------------------------------------------------------
// Responsive design helpers
// ---------------------------------------------------------------------------

/**
 * Checks for a viewport meta tag with `width=device-width`.
 *
 * @param html - The full HTML source string.
 * @returns `true` if a correctly-configured viewport meta tag is present.
 */
function hasViewportMeta(html: string): boolean {
  return /<meta[^>]+name\s*=\s*["']viewport["'][^>]+content\s*=\s*["'][^"']*width\s*=\s*device-width[^"']*["'][^>]*>/i.test(html);
}

/**
 * Checks for the presence of `srcset` attributes on image elements.
 *
 * @param html - The full HTML source string.
 * @returns `true` if at least one `<img>` uses `srcset`.
 */
function hasSrcset(html: string): boolean {
  return /<img[^>]+srcset\s*=/i.test(html);
}

/**
 * Checks for the presence of `<picture>` elements.
 *
 * @param html - The full HTML source string.
 * @returns `true` if at least one `<picture>` element exists.
 */
function hasPictureElements(html: string): boolean {
  return /<picture[\s>]/i.test(html);
}

// ---------------------------------------------------------------------------
// Check implementation
// ---------------------------------------------------------------------------

/**
 * Architecture planning check for tool pages.
 *
 * Validates that the page demonstrates solid front-end architecture through
 * semantic HTML structure, progressive enhancement, accessibility foundations,
 * and responsive design indicators.
 *
 * Scoring breakdown (each component scaled to its weight, totalling 0–100):
 * - **Semantic structure (30%)**: Presence of semantic HTML5 landmark elements.
 * - **Progressive enhancement (25%)**: `<noscript>` fallbacks and server-rendered content.
 * - **Accessibility foundations (25%)**: `<label>`, `aria-*`, and `role` attributes.
 * - **Responsive design (20%)**: Viewport meta, `srcset`, and `<picture>` elements.
 *
 * @see toolPlannerConfig.checks.architecturePlanning
 */
export const architecturePlanningCheck: PluginCheck = {
  name: 'architecture-planning',
  description:
    'Validates tool page architecture including semantic structure, progressive enhancement, accessibility foundations, and responsive design indicators.',
  severity: 'warning',
  weight: CONFIG.weight,

  /**
   * Executes the architecture planning check against the supplied context.
   *
   * @param context - The page / site context to evaluate.
   * @returns A promise resolving to the structured check result. Never throws.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const issues: string[] = [];

      /* ---------- Semantic structure (30 pts) ---------- */
      const semanticCount = countSemanticElements(html);
      let semanticScore: number;

      if (semanticCount === 0) {
        semanticScore = 0;
        issues.push('No semantic HTML5 landmark elements found (<main>, <article>, <section>, etc.).');
      } else if (semanticCount === 1) {
        semanticScore = 10;
        issues.push(`Only ${semanticCount} semantic element found; use at least 3 for good structure.`);
      } else if (semanticCount === 2) {
        semanticScore = 20;
        issues.push(`Only ${semanticCount} semantic elements found; use at least 3 for good structure.`);
      } else {
        // 3+ semantic elements → full marks
        semanticScore = 30;
      }

      /* ---------- Progressive enhancement (25 pts) ---------- */
      const hasNoscript = hasNoscriptFallback(html);
      const hasServerContent = hasServerRenderedContentBeforeScripts(html);
      let progressiveScore = 0;

      if (hasNoscript) {
        progressiveScore += 12;
      } else {
        issues.push('No <noscript> fallback found; tool should work without JavaScript.');
      }

      if (hasServerContent) {
        progressiveScore += 13;
      } else {
        issues.push('Insufficient server-rendered content before <script> tags.');
      }

      /* ---------- Accessibility foundations (25 pts) ---------- */
      const a11y = evaluateAccessibility(html);
      let accessibilityScore: number;

      if (a11y.signalCount === 0) {
        accessibilityScore = 0;
        issues.push('No accessibility foundations found: missing <label>, aria-*, and role attributes.');
      } else if (a11y.signalCount === 1) {
        accessibilityScore = 8;
        issues.push('Limited accessibility: only one type of accessibility signal found.');
      } else if (a11y.signalCount === 2) {
        accessibilityScore = 17;
        issues.push('Partial accessibility: consider adding all of <label>, aria-*, and role attributes.');
      } else {
        accessibilityScore = 25;
      }

      /* ---------- Responsive design (20 pts) ---------- */
      const viewport = hasViewportMeta(html);
      const srcset = hasSrcset(html);
      const picture = hasPictureElements(html);

      let responsiveScore = 0;

      if (viewport) {
        responsiveScore += 10;
      } else {
        issues.push('Missing viewport meta tag with width=device-width.');
      }

      if (srcset) {
        responsiveScore += 5;
      }

      if (picture) {
        responsiveScore += 5;
      }

      if (!srcset && !picture) {
        issues.push('No responsive image techniques found (srcset or <picture> elements).');
      }

      const totalScore = semanticScore + progressiveScore + accessibilityScore + responsiveScore;
      const passed = totalScore >= toolPlannerConfig.threshold;

      return {
        checkName: 'architecture-planning',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Architecture planning passes all checks.'
            : issues.join(' '),
        details: {
          semanticCount,
          semanticScore,
          progressiveScore,
          hasNoscript,
          hasServerContent,
          accessibilityScore,
          hasLabels: a11y.hasLabels,
          hasAriaAttributes: a11y.hasAriaAttributes,
          hasRoleAttributes: a11y.hasRoleAttributes,
          responsiveScore,
          hasViewport: viewport,
          hasSrcset: srcset,
          hasPicture: picture,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Ensure the page uses semantic HTML5 elements (<main>, <article>, <section>), includes <noscript> fallbacks, adds <label>/aria-*/role attributes for accessibility, and provides responsive images via srcset or <picture>.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'architecture-planning',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Architecture planning check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the architecture planning check encountered an internal error.',
      };
    }
  },
};
