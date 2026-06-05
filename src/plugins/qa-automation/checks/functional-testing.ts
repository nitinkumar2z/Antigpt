/**
 * @fileoverview Functional testing check for the QA Automation plugin.
 * @module plugins/qa-automation/checks/functional-testing
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { qaAutomationConfig } from '../config.js';

const cfg = qaAutomationConfig.checks.functionalTesting;

/**
 * Validates functional integrity of the page.
 *
 * Checks HTML completeness, duplicate IDs, form structure,
 * link targets, and script integrity.
 */
export const functionalTestingCheck: PluginCheck = {
  name: 'functional-testing',
  description: 'Validates functional integrity including HTML completeness, duplicate IDs, form structure, and link targets.',
  severity: 'warning',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, siteConfig } = context;

      // 1. HTML completeness (25%)
      const closingTags = ['</html>', '</head>', '</body>', '</main>'];
      const foundClosing = closingTags.filter((tag) => html.toLowerCase().includes(tag)).length;
      const completenessScore = Math.round((foundClosing / closingTags.length) * 100);

      // 2. No duplicate IDs (20%)
      const idMatches = html.match(/\bid\s*=\s*["']([^"']+)["']/gi) || [];
      const ids = idMatches.map((m) => {
        const match = m.match(/["']([^"']+)["']/);
        return match ? match[1] : '';
      }).filter(Boolean);
      const uniqueIds = new Set(ids);
      const dupIdScore = ids.length > 0 ? Math.round((uniqueIds.size / ids.length) * 100) : 100;

      // 3. Form structure (20%)
      const forms = html.match(/<form[^>]*>/gi) || [];
      const formsWithAction = forms.filter((f) => /action\s*=\s*["'][^"']*["']/i.test(f)).length;
      const formScore = forms.length > 0 ? Math.round((formsWithAction / forms.length) * 100) : 100;

      // 4. Link targets (20%)
      const externalLinks = html.match(/<a[^>]+href\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi) || [];
      const domain = siteConfig.baseUrl.replace(/^https?:\/\//, '');
      const extOnly = externalLinks.filter((a) => !a.includes(domain));
      const safeExtLinks = extOnly.filter((a) => /rel\s*=\s*["'][^"']*noopener[^"']*["']/i.test(a)).length;
      const linkScore = extOnly.length > 0 ? Math.round((safeExtLinks / extOnly.length) * 100) : 100;

      // 5. Script integrity (15%)
      const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
      const validScripts = scripts.filter((s) => {
        const hasSrc = /\bsrc\s*=\s*["'][^"']+["']/i.test(s);
        const hasContent = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim().length > 0;
        return hasSrc || hasContent;
      }).length;
      const scriptScore = scripts.length > 0 ? Math.round((validScripts / scripts.length) * 100) : 100;

      const score = Math.round(
        completenessScore * 0.25 + dupIdScore * 0.20 + formScore * 0.20 +
        linkScore * 0.20 + scriptScore * 0.15
      );
      const passed = score >= 60;

      return {
        checkName: 'functional-testing',
        score,
        passed,
        severity: 'warning',
        message: passed
          ? `Functional testing passed (${score}/100). Page structure is sound.`
          : `Functional testing issues found (${score}/100). Structural problems detected.`,
        details: { completenessScore, dupIdScore, formScore, linkScore, scriptScore, totalIds: ids.length, uniqueIds: uniqueIds.size },
        fixSuggestion: !passed
          ? 'Ensure HTML tags are properly closed, remove duplicate IDs, add rel="noopener" to external links.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'functional-testing',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Functional testing failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
