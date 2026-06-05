/**
 * @module tool-planner/checks/database-planning
 * @description Validates data structure and parameterization for programmatic
 * tool pages.
 *
 * Evaluates four dimensions of database/data-readiness:
 * 1. **Data source indicators** – presence of JSON-LD with dataset schema or
 *    well-structured `<table>` elements with header rows.
 * 2. **Dynamic content markers** – template variables (`{{…}}`, `${…}`) and
 *    `data-*` attributes with structured naming conventions.
 * 3. **Content parameterization** – extractable key values such as numbers,
 *    dates, percentages, and named entities within the HTML content.
 * 4. **Data freshness indicators** – timestamps, version numbers, and update
 *    dates signalling that the data is maintained.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { toolPlannerConfig } from '../config.js';

const CONFIG = toolPlannerConfig.checks.databasePlanning;

// ---------------------------------------------------------------------------
// Data source helpers
// ---------------------------------------------------------------------------

/**
 * Checks for JSON-LD blocks containing Dataset schema references.
 *
 * @param html - The full HTML source string.
 * @returns `true` if a JSON-LD script block referencing Dataset is found.
 */
function hasJsonLdDataset(html: string): boolean {
  const jsonLdBlocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!jsonLdBlocks) {
    return false;
  }
  return jsonLdBlocks.some((block) => {
    const content = block.replace(/<\/?script[^>]*>/gi, '');
    return /["']@type["']\s*:\s*["']Dataset["']/i.test(content) ||
           /["']@type["']\s*:\s*["']DataCatalog["']/i.test(content) ||
           /["']@type["']\s*:\s*["']Table["']/i.test(content);
  });
}

/**
 * Checks for well-structured HTML tables with `<thead>` or `<th>` header
 * elements, indicating a tabular data source.
 *
 * @param html - The full HTML source string.
 * @returns `true` if at least one table with headers is found.
 */
function hasStructuredTables(html: string): boolean {
  const hasTableWithHead = /<table[\s\S]*?<thead[\s\S]*?<\/thead>/i.test(html);
  const hasTableWithTh = /<table[\s\S]*?<th[\s>]/i.test(html);
  return hasTableWithHead || hasTableWithTh;
}

// ---------------------------------------------------------------------------
// Dynamic content helpers
// ---------------------------------------------------------------------------

/** Pattern matching template variables: `{{variable}}` or `${variable}`. */
const TEMPLATE_VAR_PATTERN = /\{\{[\w.]+\}\}|\$\{[\w.]+\}/g;

/** Pattern matching structured `data-*` attributes (e.g. `data-tool-id`, `data-metric-value`). */
const STRUCTURED_DATA_ATTR_PATTERN = /\bdata-[\w]+-[\w]+\s*=/gi;

/**
 * Counts template variable occurrences in the HTML.
 *
 * @param html - The full HTML source string.
 * @returns The number of template variable patterns found.
 */
function countTemplateVariables(html: string): number {
  const matches = html.match(TEMPLATE_VAR_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Counts structured `data-*` attributes (those with at least one hyphen
 * after `data-`, indicating a naming convention like `data-tool-id`).
 *
 * @param html - The full HTML source string.
 * @returns The number of structured data attributes found.
 */
function countStructuredDataAttributes(html: string): number {
  const matches = html.match(STRUCTURED_DATA_ATTR_PATTERN);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Parameterization helpers
// ---------------------------------------------------------------------------

/** Pattern matching standalone numbers (integers and decimals). */
const NUMBER_PATTERN = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g;

/** Pattern matching date-like strings (ISO 8601, US dates, etc.). */
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})\b/gi;

/** Pattern matching percentage values. */
const PERCENTAGE_PATTERN = /\b\d+(?:\.\d+)?%/g;

/** Pattern matching currency values. */
const CURRENCY_PATTERN = /[$€£¥₹]\s*\d+(?:[,.\d]+)?/g;

/**
 * Evaluates content parameterization by detecting extractable key values
 * (numbers, dates, percentages, currencies) in the text content of the HTML.
 *
 * @param html - The full HTML source string.
 * @returns An object containing counts of each value type and total.
 */
function evaluateParameterization(html: string): {
  numberCount: number;
  dateCount: number;
  percentageCount: number;
  currencyCount: number;
  totalValues: number;
} {
  // Strip HTML tags to evaluate text content only
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ');

  const numbers = textContent.match(NUMBER_PATTERN);
  const dates = textContent.match(DATE_PATTERN);
  const percentages = textContent.match(PERCENTAGE_PATTERN);
  const currencies = textContent.match(CURRENCY_PATTERN);

  const numberCount = numbers ? numbers.length : 0;
  const dateCount = dates ? dates.length : 0;
  const percentageCount = percentages ? percentages.length : 0;
  const currencyCount = currencies ? currencies.length : 0;

  return {
    numberCount,
    dateCount,
    percentageCount,
    currencyCount,
    totalValues: numberCount + dateCount + percentageCount + currencyCount,
  };
}

// ---------------------------------------------------------------------------
// Freshness indicator helpers
// ---------------------------------------------------------------------------

/**
 * Pattern matching ISO 8601 timestamps (with optional time component).
 * Used specifically in structured contexts like `<time>` or `datetime=`.
 */
const DATETIME_ATTR_PATTERN = /datetime\s*=\s*["']\d{4}-\d{2}-\d{2}/gi;

/** Pattern matching `<time>` elements. */
const TIME_ELEMENT_PATTERN = /<time[\s>]/gi;

/** Pattern matching version number strings (e.g. v1.2.3, Version 2.0). */
const VERSION_PATTERN = /\b(?:v(?:ersion)?\s*\d+(?:\.\d+)+)\b/gi;

/** Phrases indicating recency or update cadence. */
const UPDATE_PHRASES_PATTERN = /\b(?:last\s+updated|updated\s+on|as\s+of|current\s+as\s+of|data\s+from|retrieved\s+on|published\s+on)\b/gi;

/**
 * Evaluates data freshness indicators in the HTML.
 *
 * @param html - The full HTML source string.
 * @returns An object with boolean flags for each signal and total count.
 */
function evaluateFreshness(html: string): {
  hasDatetimeAttributes: boolean;
  hasTimeElements: boolean;
  hasVersionNumbers: boolean;
  hasUpdatePhrases: boolean;
  signalCount: number;
} {
  const hasDatetimeAttributes = DATETIME_ATTR_PATTERN.test(html);
  DATETIME_ATTR_PATTERN.lastIndex = 0;

  const hasTimeElements = TIME_ELEMENT_PATTERN.test(html);
  TIME_ELEMENT_PATTERN.lastIndex = 0;

  const hasVersionNumbers = VERSION_PATTERN.test(html);
  VERSION_PATTERN.lastIndex = 0;

  const hasUpdatePhrases = UPDATE_PHRASES_PATTERN.test(html);
  UPDATE_PHRASES_PATTERN.lastIndex = 0;

  let signalCount = 0;
  if (hasDatetimeAttributes) signalCount++;
  if (hasTimeElements) signalCount++;
  if (hasVersionNumbers) signalCount++;
  if (hasUpdatePhrases) signalCount++;

  return {
    hasDatetimeAttributes,
    hasTimeElements,
    hasVersionNumbers,
    hasUpdatePhrases,
    signalCount,
  };
}

// ---------------------------------------------------------------------------
// Check implementation
// ---------------------------------------------------------------------------

/**
 * Database planning check for tool pages.
 *
 * Validates that the page demonstrates readiness for programmatic data-driven
 * content generation through structured data sources, dynamic content markers,
 * extractable parameterized values, and freshness indicators.
 *
 * Scoring breakdown (each component scaled to its weight, totalling 0–100):
 * - **Data source (30%)**: JSON-LD dataset references or structured tables.
 * - **Dynamic content (25%)**: Template variables and structured data attributes.
 * - **Parameterization (25%)**: Extractable numbers, dates, percentages, currencies.
 * - **Freshness indicators (20%)**: Timestamps, versions, update phrases.
 *
 * @see toolPlannerConfig.checks.databasePlanning
 */
export const databasePlanningCheck: PluginCheck = {
  name: 'database-planning',
  description:
    'Validates data structure for programmatic pages including data sources, dynamic content markers, parameterization, and freshness indicators.',
  severity: 'warning',
  weight: CONFIG.weight,

  /**
   * Executes the database planning check against the supplied context.
   *
   * @param context - The page / site context to evaluate.
   * @returns A promise resolving to the structured check result. Never throws.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const issues: string[] = [];

      /* ---------- Data source (30 pts) ---------- */
      const hasJsonLd = hasJsonLdDataset(html);
      const hasTables = hasStructuredTables(html);
      let dataSourceScore: number;

      if (hasJsonLd && hasTables) {
        dataSourceScore = 30;
      } else if (hasJsonLd) {
        dataSourceScore = 22;
        issues.push('JSON-LD dataset found but no structured HTML tables with headers.');
      } else if (hasTables) {
        dataSourceScore = 22;
        issues.push('Structured tables found but no JSON-LD dataset schema.');
      } else {
        dataSourceScore = 0;
        issues.push('No structured data sources found: add JSON-LD with Dataset schema or tables with <thead>/<th>.');
      }

      /* ---------- Dynamic content (25 pts) ---------- */
      const templateVarCount = countTemplateVariables(html);
      const dataAttrCount = countStructuredDataAttributes(html);
      let dynamicContentScore: number;

      const hasTemplates = templateVarCount > 0;
      const hasDataAttrs = dataAttrCount >= 3;

      if (hasTemplates && hasDataAttrs) {
        dynamicContentScore = 25;
      } else if (hasTemplates) {
        dynamicContentScore = 15;
        issues.push('Template variables found but few structured data-* attributes.');
      } else if (hasDataAttrs) {
        dynamicContentScore = 15;
        issues.push('Structured data-* attributes found but no template variables.');
      } else if (dataAttrCount > 0) {
        dynamicContentScore = 8;
        issues.push('Few dynamic content markers found; add template variables and structured data-* attributes.');
      } else {
        dynamicContentScore = 0;
        issues.push('No dynamic content markers found: add template variables ({{…}}) and structured data-* attributes.');
      }

      /* ---------- Parameterization (25 pts) ---------- */
      const params = evaluateParameterization(html);
      let parameterizationScore: number;

      if (params.totalValues >= 10) {
        parameterizationScore = 25;
      } else if (params.totalValues >= 5) {
        parameterizationScore = 18;
      } else if (params.totalValues >= 2) {
        parameterizationScore = 10;
        issues.push('Limited parameterized values found; tool pages should contain extractable numbers, dates, or percentages.');
      } else {
        parameterizationScore = 0;
        issues.push('No extractable parameterized values found (numbers, dates, percentages, currencies).');
      }

      /* ---------- Freshness indicators (20 pts) ---------- */
      const freshness = evaluateFreshness(html);
      let freshnessScore: number;

      if (freshness.signalCount >= 3) {
        freshnessScore = 20;
      } else if (freshness.signalCount === 2) {
        freshnessScore = 14;
        issues.push('Some freshness indicators found; consider adding datetime attributes, <time> elements, or "last updated" text.');
      } else if (freshness.signalCount === 1) {
        freshnessScore = 7;
        issues.push('Only one freshness indicator found; add timestamps, version numbers, or update date phrases.');
      } else {
        freshnessScore = 0;
        issues.push('No data freshness indicators found: add <time> elements, datetime attributes, version numbers, or "last updated" text.');
      }

      const totalScore = dataSourceScore + dynamicContentScore + parameterizationScore + freshnessScore;
      const passed = totalScore >= toolPlannerConfig.threshold;

      return {
        checkName: 'database-planning',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Database planning passes all checks.'
            : issues.join(' '),
        details: {
          dataSourceScore,
          hasJsonLdDataset: hasJsonLd,
          hasStructuredTables: hasTables,
          dynamicContentScore,
          templateVarCount,
          dataAttrCount,
          parameterizationScore,
          numberCount: params.numberCount,
          dateCount: params.dateCount,
          percentageCount: params.percentageCount,
          currencyCount: params.currencyCount,
          totalExtractableValues: params.totalValues,
          freshnessScore,
          hasDatetimeAttributes: freshness.hasDatetimeAttributes,
          hasTimeElements: freshness.hasTimeElements,
          hasVersionNumbers: freshness.hasVersionNumbers,
          hasUpdatePhrases: freshness.hasUpdatePhrases,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Add JSON-LD dataset schema, structured <table> elements, template variables, data-* attributes, extractable numeric/date values, and freshness indicators like <time> elements or "last updated" text.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'database-planning',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Database planning check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the database planning check encountered an internal error.',
      };
    }
  },
};
