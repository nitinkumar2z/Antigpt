/**
 * @fileoverview Remediation planning check for the Google Update Response Engine.
 * @module plugins/google-update-engine/checks/remediation-planning
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { googleUpdateEngineConfig } from '../config.js';

const cfg = googleUpdateEngineConfig.checks.remediationPlanning;

/**
 * Evaluates remediation readiness for Google algorithm updates.
 *
 * Checks update flexibility, content diversification, recovery infrastructure,
 * and monitoring readiness to ensure quick recovery from ranking drops.
 */
export const remediationPlanningCheck: PluginCheck = {
  name: 'remediation-planning',
  description: 'Evaluates remediation readiness including update flexibility, diversification, recovery infrastructure, and monitoring.',
  severity: 'info',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, metadata } = context;

      // 1. Update flexibility (25%)
      const hasDates = metadata.updatedAt || metadata.publishedAt || /\d{4}-\d{2}-\d{2}/.test(html);
      const headingCount = (html.match(/<h2/gi) || []).length;
      const modular = headingCount >= 3;
      const flexSignals = (hasDates ? 1 : 0) + (modular ? 1 : 0) + (metadata.updatedAt ? 1 : 0);
      const flexScore = Math.round((flexSignals / 3) * 100);

      // 2. Diversification (25%)
      const hasText = metadata.wordCount > 200;
      const hasLists = /<(?:ul|ol)/i.test(html);
      const hasTables = /<table/i.test(html);
      const hasImages = /<img/i.test(html);
      const hasSocialMeta = /<meta[^>]*property\s*=\s*["']og:/i.test(html);
      const contentTypes = [hasText, hasLists, hasTables, hasImages, hasSocialMeta].filter(Boolean).length;
      const diverseScore = Math.round((contentTypes / 5) * 100);

      // 3. Recovery infrastructure (25%)
      const hasSitemap = /sitemap/i.test(html);
      const hasCanonical = /<link[^>]*rel\s*=\s*["']canonical["']/i.test(html);
      const hasJsonLd = /application\/ld\+json/i.test(html);
      const recoverySignals = (hasSitemap ? 1 : 0) + (hasCanonical ? 1 : 0) + (hasJsonLd ? 1 : 0);
      const recoveryScore = Math.round((recoverySignals / 3) * 100);

      // 4. Monitoring readiness (25%)
      const hasAnalytics = /gtag|google-analytics|ga\.js|analytics\.js|googletagmanager/i.test(html);
      const hasSearchConsole = /<meta[^>]*name\s*=\s*["']google-site-verification["']/i.test(html);
      const monitorSignals = (hasAnalytics ? 1 : 0) + (hasSearchConsole ? 1 : 0);
      const monitorScore = Math.round((monitorSignals / 2) * 100);

      const score = Math.round(
        flexScore * 0.25 + diverseScore * 0.25 + recoveryScore * 0.25 + monitorScore * 0.25
      );
      const passed = score >= 40;

      return {
        checkName: 'remediation-planning',
        score,
        passed,
        severity: 'info',
        message: passed
          ? `Remediation planning passed (${score}/100). Good recovery readiness.`
          : `Remediation planning weak (${score}/100). Limited recovery capability.`,
        details: { flexScore, diverseScore, recoveryScore, monitorScore, contentTypes },
        fixSuggestion: !passed
          ? 'Add updatable dates, diversify content types, include sitemap/canonical/JSON-LD, and add analytics tracking.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'remediation-planning',
        score: 0,
        passed: false,
        severity: 'info',
        message: `Remediation planning failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
