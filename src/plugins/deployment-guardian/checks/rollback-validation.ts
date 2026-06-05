/**
 * @fileoverview Rollback validation check for the Deployment Guardian plugin.
 * @module plugins/deployment-guardian/checks/rollback-validation
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { deploymentGuardianConfig } from '../config.js';

const cfg = deploymentGuardianConfig.checks.rollbackValidation;

/**
 * Validates rollback readiness for safe deployments.
 *
 * Checks content versioning, URL stability, structural completeness,
 * and state independence for clean rollback capability.
 */
export const rollbackValidationCheck: PluginCheck = {
  name: 'rollback-validation',
  description: 'Validates rollback readiness including content versioning, stable URLs, structural completeness, and state independence.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;

      // 1. Content versioning (30%)
      const hasBuildId = /<meta[^>]*name\s*=\s*["']build-id["']/i.test(html);
      const hasGenerator = /<meta[^>]*name\s*=\s*["']generator["']/i.test(html);
      const hasDateStamp = /\d{4}-\d{2}-\d{2}/.test(html);
      const versionSignals = (hasBuildId ? 1 : 0) + (hasGenerator ? 1 : 0) + (hasDateStamp ? 1 : 0);
      const versionScore = Math.min(Math.round((versionSignals / 2) * 100), 100);

      // 2. Stable URLs (25%)
      const hasCanonical = /<link[^>]*rel\s*=\s*["']canonical["']/i.test(html);
      const canonicalMatch = html.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
      const isHttps = canonicalMatch ? canonicalMatch[1].startsWith('https') : false;
      const urlScore = (hasCanonical ? 50 : 0) + (isHttps ? 50 : 0);

      // 3. No breaking changes (25%)
      const hasNav = /<nav\b/i.test(html) || /role\s*=\s*["']navigation["']/i.test(html);
      const hasMain = /<main\b/i.test(html) || /role\s*=\s*["']main["']/i.test(html);
      const hasFooter = /<footer\b/i.test(html) || /role\s*=\s*["']contentinfo["']/i.test(html);
      const structureScore = Math.round(((hasNav ? 1 : 0) + (hasMain ? 1 : 0) + (hasFooter ? 1 : 0)) / 3 * 100);

      // 4. State independence (20%)
      const hasToken = /(?:csrf|token|session_id|auth_token)\s*[:=]\s*["'][^"']+["']/i.test(html);
      const hasUserData = /(?:user_id|user_email|logged_in)\s*[:=]/i.test(html);
      const stateScore = !hasToken && !hasUserData ? 100 : 0;

      const score = Math.round(
        versionScore * 0.30 + urlScore * 0.25 + structureScore * 0.25 + stateScore * 0.20
      );
      const passed = score >= 60;

      return {
        checkName: 'rollback-validation',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Rollback validation passed (${score}/100). Safe to deploy.`
          : `Rollback readiness issues (${score}/100). Review before deploying.`,
        details: { versionScore, urlScore, structureScore, stateScore, hasBuildId, hasCanonical },
        fixSuggestion: !passed
          ? 'Add build-id meta tag, ensure canonical uses HTTPS, include nav/main/footer elements, remove session-dependent content.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'rollback-validation',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Rollback validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
