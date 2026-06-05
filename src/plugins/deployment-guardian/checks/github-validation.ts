/**
 * @module deployment-guardian/checks/github-validation
 * @description Validates GitHub deployment readiness by analysing HTML/content
 * signals for version control indicators, deployment metadata, CI/CD readiness,
 * and the absence of development artifacts.
 *
 * Scoring breakdown (each sub-check contributes 25 %):
 * - **version-tracking** — version numbers, commit hashes, build timestamps.
 * - **deployment-meta**  — `<meta name="generator">`, `<meta name="build-id">`, `data-version`.
 * - **ci-cd-ready**      — proper HTML structure that would pass automated testing.
 * - **no-dev-artifacts** — no localhost URLs, debug comments, or console.log remnants.
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { deploymentGuardianConfig } from '../config.js';

const CHECK_NAME = 'github-validation';
const cfg = deploymentGuardianConfig.checks.githubValidation;

// ---------------------------------------------------------------------------
// Sub-check helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate version-tracking signals in the HTML.
 *
 * Looks for semantic version strings, short commit hashes, and ISO-8601-ish
 * build timestamps embedded in meta tags, HTML comments, or `data-*` attributes.
 *
 * @param html - Rendered page HTML.
 * @returns Score from 0–100.
 */
function evaluateVersionTracking(html: string): { score: number; found: string[] } {
  const found: string[] = [];

  /** Semantic version numbers (v1.2.3 or 1.2.3). */
  if (/\bv?\d+\.\d+\.\d+(?:-[\w.]+)?\b/.test(html)) {
    found.push('semver');
  }

  /** Short or full Git commit hashes (7–40 hex chars preceded by a label hint). */
  if (/(?:commit|sha|rev|hash|version)[:\s="'-]*[0-9a-f]{7,40}\b/i.test(html)) {
    found.push('commit-hash');
  }

  /** Build timestamps (ISO-8601 or common build-date patterns in meta/comments). */
  if (/(?:build[-_]?(?:time|date|stamp|at)|built[-_]?at)[:\s="'-]*\d{4}-\d{2}-\d{2}/i.test(html)) {
    found.push('build-timestamp');
  }

  const ratio = Math.min(1, found.length / 2);
  return { score: Math.round(ratio * 100), found };
}

/**
 * Evaluate deployment metadata tags.
 *
 * Checks for `<meta name="generator">`, `<meta name="build-id">`,
 * and `data-version` attributes anywhere in the HTML.
 *
 * @param html - Rendered page HTML.
 * @returns Score from 0–100.
 */
function evaluateDeploymentMeta(html: string): { score: number; found: string[] } {
  const found: string[] = [];

  if (/<meta\s[^>]*name\s*=\s*["']generator["'][^>]*>/i.test(html)) {
    found.push('meta-generator');
  }

  if (/<meta\s[^>]*name\s*=\s*["']build-id["'][^>]*>/i.test(html)) {
    found.push('meta-build-id');
  }

  if (/data-version\s*=\s*["'][^"']+["']/i.test(html)) {
    found.push('data-version');
  }

  const ratio = Math.min(1, found.length / 2);
  return { score: Math.round(ratio * 100), found };
}

/**
 * Evaluate CI/CD readiness through proper HTML structure.
 *
 * A well-formed page that would pass automated smoke tests should contain
 * a `<!DOCTYPE>`, `<html>`, `<head>` with `<title>`, and a `<body>`.
 *
 * @param html - Rendered page HTML.
 * @returns Score from 0–100.
 */
function evaluateCiCdReadiness(html: string): { score: number; issues: string[] } {
  let points = 0;
  const issues: string[] = [];

  if (/<!doctype\s+html>/i.test(html)) {
    points += 25;
  } else {
    issues.push('Missing <!DOCTYPE html> declaration.');
  }

  if (/<html[\s>]/i.test(html)) {
    points += 25;
  } else {
    issues.push('Missing <html> element.');
  }

  if (/<head[\s>]/i.test(html) && /<title[\s>]/i.test(html)) {
    points += 25;
  } else {
    issues.push('Missing <head> or <title> element.');
  }

  if (/<body[\s>]/i.test(html)) {
    points += 25;
  } else {
    issues.push('Missing <body> element.');
  }

  return { score: points, issues };
}

/**
 * Check for the absence of development artifacts.
 *
 * Penalises: `localhost` / `127.0.0.1` URLs, `<!-- DEBUG` comments,
 * and `console.log` / `console.debug` calls in inline `<script>` blocks.
 *
 * @param html - Rendered page HTML.
 * @returns Score from 0–100 (100 = clean, 0 = many artifacts).
 */
function evaluateNoDevArtifacts(html: string): { score: number; found: string[] } {
  const found: string[] = [];

  /** Localhost or loopback URLs. */
  if (/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?:[:/]|['"\s>])/i.test(html)) {
    found.push('localhost-url');
  }

  /** Debug HTML comments. */
  if (/<!--\s*DEBUG\b/i.test(html)) {
    found.push('debug-comment');
  }

  /** console.log / console.debug in inline scripts. */
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const body = scriptMatch[1];
    if (/\bconsole\s*\.\s*(?:log|debug)\s*\(/i.test(body)) {
      found.push('console-log-in-script');
      break;
    }
  }

  /** Score: each artifact removes ~33 points. */
  const score = Math.max(0, Math.round(100 - (found.length / 3) * 100));
  return { score, found };
}

// ---------------------------------------------------------------------------
// Exported check
// ---------------------------------------------------------------------------

/**
 * GitHub Validation check for the Deployment Guardian plugin.
 *
 * Validates that the page is ready for a GitHub-driven deployment pipeline by
 * inspecting version tracking, deployment metadata, CI/CD-compatible structure,
 * and the absence of development artifacts.
 */
export const githubValidationCheck: PluginCheck = {
  name: CHECK_NAME,
  description:
    'Validates GitHub deployment readiness: version tracking, deployment metadata, CI/CD structure, and absence of dev artifacts.',
  severity: 'critical',
  weight: cfg.weight,

  /**
   * Execute the GitHub validation check.
   *
   * @param context - Page context containing HTML, raw content, and metadata.
   * @returns Structured check result; never throws.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const versionTracking = evaluateVersionTracking(context.html);
      const deploymentMeta = evaluateDeploymentMeta(context.html);
      const ciCdReady = evaluateCiCdReadiness(context.html);
      const noDevArtifacts = evaluateNoDevArtifacts(context.html);

      const score = Math.round(
        versionTracking.score * 0.25 +
        deploymentMeta.score * 0.25 +
        ciCdReady.score * 0.25 +
        noDevArtifacts.score * 0.25,
      );

      const passed = score >= 50;

      const issues: string[] = [];
      if (versionTracking.score < 50) {
        issues.push('No version control indicators (semver, commit hash, or build timestamp) detected.');
      }
      if (deploymentMeta.score < 50) {
        issues.push('Missing deployment metadata (generator, build-id, or data-version attributes).');
      }
      if (ciCdReady.score < 50) {
        issues.push(`HTML structure issues: ${ciCdReady.issues.join(' ')}`);
      }
      if (noDevArtifacts.score < 50) {
        issues.push(`Development artifacts found: ${noDevArtifacts.found.join(', ')}.`);
      }

      const message =
        issues.length === 0
          ? 'Page passes GitHub deployment readiness checks.'
          : `GitHub validation issues: ${issues.join(' ')}`;

      const fixParts: string[] = [];
      if (versionTracking.score < 50) {
        fixParts.push(
          'Add version indicators: include a <meta name="build-id" content="..."> or embed a commit hash/build timestamp in HTML comments.',
        );
      }
      if (deploymentMeta.score < 50) {
        fixParts.push(
          'Add deployment metadata: <meta name="generator" content="...">, <meta name="build-id" content="...">, or data-version attributes.',
        );
      }
      if (ciCdReady.score < 50) {
        fixParts.push(
          'Ensure the page has a valid <!DOCTYPE html>, <html>, <head> with <title>, and <body> elements.',
        );
      }
      if (noDevArtifacts.score < 50) {
        fixParts.push(
          'Remove development artifacts: eliminate localhost URLs, <!-- DEBUG comments, and console.log calls from inline scripts.',
        );
      }

      return {
        checkName: CHECK_NAME,
        score,
        passed,
        severity: 'critical',
        message,
        details: {
          versionTrackingScore: versionTracking.score,
          versionTrackingFound: versionTracking.found,
          deploymentMetaScore: deploymentMeta.score,
          deploymentMetaFound: deploymentMeta.found,
          ciCdReadyScore: ciCdReady.score,
          ciCdReadyIssues: ciCdReady.issues,
          noDevArtifactsScore: noDevArtifacts.score,
          devArtifactsFound: noDevArtifacts.found,
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
        message: `GitHub validation check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Ensure the page contains valid HTML with standard document structure.',
      };
    }
  },
};
