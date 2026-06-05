/**
 * @fileoverview Content freshness check for the Quality Gatekeeper plugin.
 *
 * Scores content based on how recently it was updated, using an exponential
 * decay model.  Fresher content scores higher, reflecting search engines'
 * preference for up-to-date material.
 *
 * Decay formula:
 *   freshnessScore = 100 × exp(-decayRate × daysSinceUpdate / maxAgeDays)
 *
 * Special cases:
 * - Updated within the last 30 days → score 100 (grace period).
 * - No date metadata available → score 50 (neutral / unknown).
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.freshness;

/** Number of days within which content is considered "fresh" unconditionally. */
const FRESH_GRACE_PERIOD_DAYS = 30;

/** Milliseconds in a single day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse an ISO 8601 date string into a Date object.
 *
 * Returns null for invalid or unparseable dates rather than throwing.
 *
 * @param dateStr - An ISO 8601 date string (e.g., "2025-06-01T00:00:00Z").
 * @returns A valid Date object, or null if parsing fails.
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim().length === 0) {
    return null;
  }

  const parsed = new Date(dateStr);

  // Guard against Invalid Date
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Calculate the number of days between two dates.
 *
 * @param from - The earlier date.
 * @param to   - The later date (defaults to now).
 * @returns Number of days elapsed (can be fractional, always >= 0).
 */
function daysBetween(from: Date, to: Date = new Date()): number {
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, diffMs / MS_PER_DAY);
}

/**
 * Calculate the freshness score using exponential decay.
 *
 * @param daysSinceUpdate - Days since the content was last updated.
 * @param decayRate       - Decay rate constant.
 * @param maxAgeDays      - Reference maximum age in days.
 * @returns Freshness score in [0, 100].
 */
function calculateFreshnessScore(
  daysSinceUpdate: number,
  decayRate: number,
  maxAgeDays: number,
): number {
  // Grace period: content updated within 30 days scores 100
  if (daysSinceUpdate <= FRESH_GRACE_PERIOD_DAYS) {
    return 100;
  }

  if (maxAgeDays <= 0) {
    return 100;
  }

  const raw = 100 * Math.exp(-decayRate * daysSinceUpdate / maxAgeDays);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Content freshness plugin check.
 *
 * Evaluates how recently the content was updated, applying an exponential
 * decay curve to produce a 0-100 score.  Encourages regular content
 * maintenance for SEO freshness signals.
 */
export const freshnessCheck: PluginCheck = {
  name: 'freshness',
  description:
    'Scores content freshness using an exponential decay model based on the last update date. Fresher content scores higher.',
  severity: 'info',
  weight: config.weight,

  /**
   * Execute the freshness check.
   *
   * @param context - The check context containing metadata with date fields.
   * @returns A CheckResult with the freshness score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'freshness';

    try {
      const { metadata } = context;

      // Try updatedAt first, fall back to publishedAt
      const lastUpdateDate =
        parseDate(metadata.updatedAt) ?? parseDate(metadata.publishedAt);

      // No date available — return neutral score
      if (lastUpdateDate === null) {
        return {
          checkName,
          score: 50,
          passed: true,
          severity: 'info',
          message:
            'No publication or update date available. Freshness cannot be determined.',
          details: {
            updatedAt: metadata.updatedAt ?? null,
            publishedAt: metadata.publishedAt ?? null,
            daysSinceUpdate: null,
            freshnessScore: 50,
            decayRate: config.decayRate,
            maxAgeDays: config.maxAgeDays,
          },
          fixSuggestion:
            'Add publishedAt and updatedAt dates to page metadata for accurate freshness scoring.',
        };
      }

      const now = new Date();
      const daysSinceUpdate = daysBetween(lastUpdateDate, now);
      const freshnessScore = calculateFreshnessScore(
        daysSinceUpdate,
        config.decayRate,
        config.maxAgeDays,
      );

      const passed = freshnessScore >= 40;
      const daysRounded = Math.round(daysSinceUpdate);

      let message: string;
      if (daysSinceUpdate <= FRESH_GRACE_PERIOD_DAYS) {
        message = `Content is fresh — updated ${daysRounded} day(s) ago.`;
      } else if (freshnessScore >= 70) {
        message = `Content is relatively recent (${daysRounded} days since last update).`;
      } else if (freshnessScore >= 40) {
        message = `Content is aging (${daysRounded} days since last update). Consider refreshing.`;
      } else {
        message = `Content is stale (${daysRounded} days since last update). A content refresh is strongly recommended.`;
      }

      const result: CheckResult = {
        checkName,
        score: freshnessScore,
        passed,
        severity: 'info',
        message,
        details: {
          lastUpdateDate: lastUpdateDate.toISOString(),
          daysSinceUpdate: daysRounded,
          freshnessScore,
          gracePeriodDays: FRESH_GRACE_PERIOD_DAYS,
          decayRate: config.decayRate,
          maxAgeDays: config.maxAgeDays,
          usedField: metadata.updatedAt ? 'updatedAt' : 'publishedAt',
        },
      };

      if (!passed) {
        result.fixSuggestion =
          `This content was last updated ${daysRounded} days ago. ` +
          'Review and refresh the content to improve freshness signals. ' +
          'Update the updatedAt metadata field after making changes.';
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during freshness check';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'info',
        message: `Freshness check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the error and ensure date metadata is in valid ISO 8601 format.',
      };
    }
  },
};
