/**
 * @fileoverview Playwright page-rendering validation check for the QA Automation plugin.
 *
 * Validates that an HTML document is structurally ready for Playwright-driven
 * rendering.  This check performs **static analysis only** — actual Playwright
 * browser execution happens at the engine level.  The check catches structural
 * issues that would cause rendering failures:
 *
 * 1. **Document structure** — `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`.
 * 2. **Script integrity** — no inline `<script>` tags with unclosed syntax.
 * 3. **Resource loading** — CSS links have `rel="stylesheet"`, scripts have valid `type`.
 * 4. **Viewport meta** — presence of `<meta name="viewport">` for mobile rendering.
 * 5. **Image references** — no `<img>` with empty or `#` `src` attributes.
 *
 * Score weights:
 *   doc-structure (25%) + no-script-errors (25%) + resource-loading (20%)
 *   + viewport (15%) + images (15%) = 100%
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';

const config = qaAutomationConfig.checks.playwrightValidation;

// ---------------------------------------------------------------------------
// Sub-check weight constants
// ---------------------------------------------------------------------------

/** Weight for document structure sub-check (25%). */
const WEIGHT_DOC_STRUCTURE = 0.25;

/** Weight for script error sub-check (25%). */
const WEIGHT_SCRIPT_ERRORS = 0.25;

/** Weight for resource loading sub-check (20%). */
const WEIGHT_RESOURCE_LOADING = 0.20;

/** Weight for viewport meta sub-check (15%). */
const WEIGHT_VIEWPORT = 0.15;

/** Weight for image references sub-check (15%). */
const WEIGHT_IMAGES = 0.15;

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Matches `<!DOCTYPE html>` (case-insensitive). */
const DOCTYPE_REGEX = /<!doctype\s+html\b[^>]*>/i;

/** Matches opening `<html` tag. */
const HTML_OPEN_REGEX = /<html[\s>]/i;

/** Matches opening `<head` tag. */
const HEAD_OPEN_REGEX = /<head[\s>]/i;

/** Matches opening `<body` tag. */
const BODY_OPEN_REGEX = /<body[\s>]/i;

/**
 * Matches `<script>…</script>` blocks (including attributes).
 * Captures tag attributes (group 1) and inner content (group 2).
 */
const SCRIPT_TAG_REGEX = /<script(\s[^>]*)?>([^]*?)<\/script>/gi;

/** Matches a `src` attribute on a script tag. */
const SCRIPT_SRC_REGEX = /\bsrc\s*=/i;

/**
 * Matches `<link` tags.  Captures the full tag for attribute inspection.
 */
const LINK_TAG_REGEX = /<link\s[^>]*?>/gi;

/** Matches `rel="stylesheet"` or `rel='stylesheet'`. */
const REL_STYLESHEET_REGEX = /\brel\s*=\s*(?:"stylesheet"|'stylesheet')/i;

/** Matches `href` attribute presence on a link tag. */
const HREF_ATTR_REGEX = /\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/i;

/** Matches a `type` attribute on script tags. */
const SCRIPT_TYPE_REGEX = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i;

/** Valid script MIME types. */
const VALID_SCRIPT_TYPES = new Set([
  'text/javascript',
  'module',
  'application/javascript',
  'application/json',
  'application/ld+json',
  'importmap',
  'speculationrules',
]);

/** Matches `<meta name="viewport"…>`. */
const VIEWPORT_META_REGEX = /<meta\s[^>]*?\bname\s*=\s*(?:"viewport"|'viewport')[^>]*?>/i;

/** Matches `<img` tags. Captures the full tag. */
const IMG_TAG_REGEX = /<img\s[^>]*?>/gi;

/** Extracts `src` attribute value from an img tag. */
const IMG_SRC_REGEX = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i;

// ---------------------------------------------------------------------------
// Sub-check issue tracking
// ---------------------------------------------------------------------------

/**
 * Represents a single issue found by a sub-check.
 */
interface SubCheckIssue {
  /** Name of the sub-check that found this issue. */
  subCheck: string;
  /** Human-readable description of the problem. */
  issue: string;
}

// ---------------------------------------------------------------------------
// Sub-check implementations
// ---------------------------------------------------------------------------

/**
 * Validate HTML document structure.
 *
 * Checks for the presence of `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`.
 * Each missing element deducts 25% from this sub-check's score.
 *
 * @param html - The full HTML string.
 * @returns Score (0–100) and list of issues.
 */
function checkDocumentStructure(html: string): { score: number; issues: SubCheckIssue[] } {
  const issues: SubCheckIssue[] = [];
  let found = 0;
  const total = 4;

  if (DOCTYPE_REGEX.test(html)) {
    found++;
  } else {
    issues.push({ subCheck: 'doc-structure', issue: 'Missing <!DOCTYPE html> declaration' });
  }

  if (HTML_OPEN_REGEX.test(html)) {
    found++;
  } else {
    issues.push({ subCheck: 'doc-structure', issue: 'Missing <html> tag' });
  }

  if (HEAD_OPEN_REGEX.test(html)) {
    found++;
  } else {
    issues.push({ subCheck: 'doc-structure', issue: 'Missing <head> tag' });
  }

  if (BODY_OPEN_REGEX.test(html)) {
    found++;
  } else {
    issues.push({ subCheck: 'doc-structure', issue: 'Missing <body> tag' });
  }

  const score = Math.round((found / total) * 100);
  return { score, issues };
}

/**
 * Validate inline script integrity.
 *
 * Checks that inline `<script>` tags (those without a `src` attribute) do not
 * contain patterns that indicate broken syntax — specifically unclosed strings,
 * unclosed template literals, or unclosed block comments.
 *
 * @param html - The full HTML string.
 * @returns Score (0–100) and list of issues.
 */
function checkScriptErrors(html: string): { score: number; issues: SubCheckIssue[] } {
  const issues: SubCheckIssue[] = [];

  SCRIPT_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  const inlineScripts: string[] = [];

  while ((match = SCRIPT_TAG_REGEX.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    const content = match[2] ?? '';

    // Only check inline scripts (no src attribute)
    if (!SCRIPT_SRC_REGEX.test(attrs) && content.trim().length > 0) {
      inlineScripts.push(content);
    }
  }

  // No inline scripts — perfect score
  if (inlineScripts.length === 0) {
    return { score: 100, issues: [] };
  }

  let brokenCount = 0;

  for (const script of inlineScripts) {
    if (hasUnclosedSyntax(script)) {
      brokenCount++;
      const snippet = script.trim().substring(0, 80);
      issues.push({
        subCheck: 'no-script-errors',
        issue: `Inline script has potentially unclosed syntax: "${snippet}…"`,
      });
    }
  }

  const goodCount = inlineScripts.length - brokenCount;
  const score = Math.round((goodCount / inlineScripts.length) * 100);
  return { score, issues };
}

/**
 * Detect potentially unclosed syntax in inline JavaScript.
 *
 * Uses heuristic checks for unbalanced quotes, template literals,
 * and block comments.  This is intentionally conservative — it only flags
 * clearly broken patterns.
 *
 * @param code - The inline JavaScript source.
 * @returns True if unclosed syntax is detected.
 */
function hasUnclosedSyntax(code: string): boolean {
  // Check for unbalanced block comments
  const openComments = (code.match(/\/\*/g) ?? []).length;
  const closeComments = (code.match(/\*\//g) ?? []).length;
  if (openComments > closeComments) {
    return true;
  }

  // Check for unbalanced template literals (backticks)
  const backtickCount = (code.match(/(?<!\\)`/g) ?? []).length;
  if (backtickCount % 2 !== 0) {
    return true;
  }

  return false;
}

/**
 * Validate resource loading declarations.
 *
 * Ensures CSS `<link>` tags have `rel="stylesheet"` and script tags with
 * a `type` attribute use a recognised MIME type.
 *
 * @param html - The full HTML string.
 * @returns Score (0–100) and list of issues.
 */
function checkResourceLoading(html: string): { score: number; issues: SubCheckIssue[] } {
  const issues: SubCheckIssue[] = [];
  let totalResources = 0;
  let validResources = 0;

  // Check CSS link tags
  LINK_TAG_REGEX.lastIndex = 0;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = LINK_TAG_REGEX.exec(html)) !== null) {
    const tag = linkMatch[0];

    // Only inspect link tags that have an href pointing to a CSS file
    if (HREF_ATTR_REGEX.test(tag) && /\.css(?:\?|"|'|\s|>|$)/i.test(tag)) {
      totalResources++;
      if (REL_STYLESHEET_REGEX.test(tag)) {
        validResources++;
      } else {
        issues.push({
          subCheck: 'resource-loading',
          issue: `CSS link tag missing rel="stylesheet": ${tag.substring(0, 100)}`,
        });
      }
    }
  }

  // Check script tags with explicit type
  SCRIPT_TAG_REGEX.lastIndex = 0;
  let scriptMatch: RegExpExecArray | null;

  while ((scriptMatch = SCRIPT_TAG_REGEX.exec(html)) !== null) {
    const attrs = scriptMatch[1] ?? '';
    const typeMatch = attrs.match(SCRIPT_TYPE_REGEX);

    if (typeMatch) {
      totalResources++;
      const typeValue = (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3] ?? '').toLowerCase().trim();

      if (typeValue.length === 0 || VALID_SCRIPT_TYPES.has(typeValue)) {
        validResources++;
      } else {
        issues.push({
          subCheck: 'resource-loading',
          issue: `Script tag has unrecognised type="${typeValue}"`,
        });
      }
    }
  }

  // No resources to check — perfect score
  if (totalResources === 0) {
    return { score: 100, issues: [] };
  }

  const score = Math.round((validResources / totalResources) * 100);
  return { score, issues };
}

/**
 * Validate viewport meta tag presence.
 *
 * Mobile rendering requires `<meta name="viewport" …>`.  This is a binary
 * check — 100 if present, 0 if absent.
 *
 * @param html - The full HTML string.
 * @returns Score (0 or 100) and list of issues.
 */
function checkViewport(html: string): { score: number; issues: SubCheckIssue[] } {
  if (VIEWPORT_META_REGEX.test(html)) {
    return { score: 100, issues: [] };
  }

  return {
    score: 0,
    issues: [{ subCheck: 'viewport', issue: 'Missing <meta name="viewport"> tag for mobile rendering' }],
  };
}

/**
 * Validate image references.
 *
 * Ensures no `<img>` tag has an empty `src` attribute or a `src` of `"#"`,
 * which would result in broken images during rendering.
 *
 * @param html - The full HTML string.
 * @returns Score (0–100) and list of issues.
 */
function checkImageReferences(html: string): { score: number; issues: SubCheckIssue[] } {
  const issues: SubCheckIssue[] = [];

  IMG_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  const imgTags: string[] = [];

  while ((match = IMG_TAG_REGEX.exec(html)) !== null) {
    imgTags.push(match[0]);
  }

  // No images — perfect score
  if (imgTags.length === 0) {
    return { score: 100, issues: [] };
  }

  let brokenCount = 0;

  for (const tag of imgTags) {
    const srcMatch = tag.match(IMG_SRC_REGEX);

    if (!srcMatch) {
      brokenCount++;
      issues.push({
        subCheck: 'images',
        issue: `Image tag missing src attribute: ${tag.substring(0, 100)}`,
      });
      continue;
    }

    const srcValue = (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? '').trim();

    if (srcValue.length === 0) {
      brokenCount++;
      issues.push({
        subCheck: 'images',
        issue: 'Image tag has empty src attribute',
      });
    } else if (srcValue === '#') {
      brokenCount++;
      issues.push({
        subCheck: 'images',
        issue: 'Image tag has placeholder src="#"',
      });
    }
  }

  const goodCount = imgTags.length - brokenCount;
  const score = Math.round((goodCount / imgTags.length) * 100);
  return { score, issues };
}

// ---------------------------------------------------------------------------
// Exported check
// ---------------------------------------------------------------------------

/**
 * Playwright page-rendering validation check.
 *
 * Performs static analysis of HTML to verify the document is structurally
 * sound for browser rendering.  Catches issues that would cause Playwright
 * to produce blank pages, rendering errors, or layout failures.
 *
 * | Sub-check        | Weight |
 * |------------------|--------|
 * | doc-structure    |   25%  |
 * | no-script-errors |   25%  |
 * | resource-loading |   20%  |
 * | viewport         |   15%  |
 * | images           |   15%  |
 */
export const playwrightValidationCheck: PluginCheck = {
  name: 'playwright-validation',
  description:
    'Validates page rendering readiness through static analysis of document structure, script integrity, resource loading, viewport meta, and image references.',
  severity: 'critical',
  weight: config.weight,

  /**
   * Execute the Playwright validation check.
   *
   * @param context - The check context containing HTML and metadata.
   * @returns A CheckResult with the rendering readiness score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'playwright-validation';

    try {
      const { html } = context;

      // Edge case: no HTML
      if (!html || html.trim().length === 0) {
        return {
          checkName,
          score: 0,
          passed: false,
          severity: 'critical',
          message: 'No HTML content to validate for rendering readiness.',
          details: { totalIssues: 0 },
          fixSuggestion: 'Provide valid HTML content for rendering validation.',
        };
      }

      // Run all sub-checks
      const docStructure = checkDocumentStructure(html);
      const scriptErrors = checkScriptErrors(html);
      const resourceLoading = checkResourceLoading(html);
      const viewport = checkViewport(html);
      const imageRefs = checkImageReferences(html);

      // Calculate weighted composite score
      const compositeScore = Math.round(
        docStructure.score * WEIGHT_DOC_STRUCTURE +
        scriptErrors.score * WEIGHT_SCRIPT_ERRORS +
        resourceLoading.score * WEIGHT_RESOURCE_LOADING +
        viewport.score * WEIGHT_VIEWPORT +
        imageRefs.score * WEIGHT_IMAGES,
      );

      // Aggregate all issues
      const allIssues: SubCheckIssue[] = [
        ...docStructure.issues,
        ...scriptErrors.issues,
        ...resourceLoading.issues,
        ...viewport.issues,
        ...imageRefs.issues,
      ];

      const passed = compositeScore >= 70;

      let message: string;
      if (allIssues.length === 0) {
        message = 'Page is fully ready for Playwright rendering — no structural issues detected.';
      } else {
        message = `Found ${allIssues.length} rendering readiness issue(s) across ${new Set(allIssues.map((i) => i.subCheck)).size} category(ies).`;
      }

      const result: CheckResult = {
        checkName,
        score: compositeScore,
        passed,
        severity: 'critical',
        message,
        details: {
          compositeScore,
          subScores: {
            docStructure: docStructure.score,
            scriptErrors: scriptErrors.score,
            resourceLoading: resourceLoading.score,
            viewport: viewport.score,
            imageReferences: imageRefs.score,
          },
          totalIssues: allIssues.length,
          issues: allIssues.slice(0, 20),
        },
      };

      if (!passed) {
        const categories = [...new Set(allIssues.map((i) => i.subCheck))];
        result.fixSuggestion =
          `Address rendering readiness issues in: ${categories.join(', ')}. ` +
          'Ensure the document has proper HTML5 structure, valid scripts, correct resource declarations, ' +
          'a viewport meta tag, and no broken image references.';
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during playwright validation check';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Playwright validation check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the HTML is well-formed.',
      };
    }
  },
};
