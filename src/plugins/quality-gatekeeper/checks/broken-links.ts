/**
 * @fileoverview Broken links check for the Quality Gatekeeper plugin.
 *
 * Validates link format integrity by extracting all `<a href>` links from the
 * HTML and verifying that each has a well-formed, non-empty href.
 *
 * This check does **not** perform HTTP requests — actual link-liveness
 * verification happens at the engine level.  This check catches:
 * - Empty hrefs
 * - Fragment-only links (`#`)
 * - Malformed protocols
 * - Missing hrefs on anchor tags
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.brokenLinks;

/**
 * Regex to extract href attributes from anchor tags.
 * Captures the href value from both single- and double-quoted attributes.
 */
const ANCHOR_REGEX = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))[^>]*>/gi;

/**
 * Regex to find anchor tags that have no href attribute at all.
 * These are technically valid HTML but semantically broken links.
 */
const ANCHOR_NO_HREF_REGEX = /<a(?:\s[^>]*)?>/gi;
const HREF_ATTR_REGEX = /\bhref\s*=/i;

/** Protocols considered valid for link hrefs. */
const VALID_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'ftp:',
  'ftps:',
]);

/**
 * Represents a single extracted link with its validation status.
 */
interface ExtractedLink {
  /** The raw href value. */
  href: string;
  /** Whether this link is internal (relative or same-origin). */
  isInternal: boolean;
  /** Whether the href format is valid. */
  isValid: boolean;
  /** Reason for invalidity, if applicable. */
  invalidReason?: string;
}

/**
 * Validate whether a single href value has correct format.
 *
 * @param href    - The raw href string.
 * @param baseUrl - The site's base URL for resolving relative links.
 * @returns An object with validity status and optional reason.
 */
function validateHref(
  href: string,
  baseUrl: string,
): { isValid: boolean; isInternal: boolean; invalidReason?: string } {
  // Empty href
  if (href.trim().length === 0) {
    return { isValid: false, isInternal: false, invalidReason: 'Empty href attribute' };
  }

  // Fragment-only link (e.g., "#")
  if (href.trim() === '#') {
    return { isValid: false, isInternal: true, invalidReason: 'Fragment-only href (#)' };
  }

  // Anchored fragment links within the same page (e.g., "#section-1") are valid
  if (href.startsWith('#') && href.length > 1) {
    return { isValid: true, isInternal: true };
  }

  // javascript: links
  if (href.trim().toLowerCase().startsWith('javascript:')) {
    return {
      isValid: false,
      isInternal: false,
      invalidReason: 'JavaScript protocol in href',
    };
  }

  // data: URIs in links are suspicious
  if (href.trim().toLowerCase().startsWith('data:')) {
    return {
      isValid: false,
      isInternal: false,
      invalidReason: 'Data URI in href',
    };
  }

  // Relative URLs are valid and internal
  if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return { isValid: true, isInternal: true };
  }

  // Absolute URLs — validate protocol
  if (href.includes('://') || href.startsWith('//')) {
    const protocolMatch = href.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
    if (protocolMatch) {
      const protocol = protocolMatch[1].toLowerCase();
      if (!VALID_PROTOCOLS.has(protocol)) {
        return {
          isValid: false,
          isInternal: false,
          invalidReason: `Unknown protocol: ${protocol}`,
        };
      }
    }

    // Check if internal (same origin)
    const isInternal = href.startsWith(baseUrl) || href.startsWith('//');
    return { isValid: true, isInternal };
  }

  // mailto: and tel: without the //
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return { isValid: true, isInternal: false };
  }

  // Anything else (e.g., "some-page") is treated as a relative URL
  return { isValid: true, isInternal: true };
}

/**
 * Extract all links from HTML and validate their format.
 *
 * @param html    - The full HTML string.
 * @param baseUrl - The site's base URL.
 * @returns Array of extracted and validated links.
 */
function extractAndValidateLinks(html: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  // Reset regex state
  ANCHOR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANCHOR_REGEX.exec(html)) !== null) {
    const href = match[1] ?? match[2] ?? match[3] ?? '';
    const validation = validateHref(href, baseUrl);

    links.push({
      href,
      isInternal: validation.isInternal,
      isValid: validation.isValid,
      invalidReason: validation.invalidReason,
    });
  }

  // Also check for <a> tags without any href attribute
  ANCHOR_NO_HREF_REGEX.lastIndex = 0;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = ANCHOR_NO_HREF_REGEX.exec(html)) !== null) {
    const tag = anchorMatch[0];
    if (!HREF_ATTR_REGEX.test(tag)) {
      links.push({
        href: '',
        isInternal: false,
        isValid: false,
        invalidReason: 'Anchor tag missing href attribute',
      });
    }
  }

  return links;
}

/**
 * Broken links format validation check.
 *
 * Parses HTML for all anchor tags and validates the format integrity of each
 * href value.  Reports the ratio of valid to total links as the quality score.
 */
export const brokenLinksCheck: PluginCheck = {
  name: 'broken-links',
  description:
    'Validates link format integrity by checking all anchor hrefs for well-formedness, correct protocols, and non-empty values.',
  severity: 'warning',
  weight: config.weight,

  /**
   * Execute the broken links format check.
   *
   * @param context - The check context containing HTML and site config.
   * @returns A CheckResult with the link validity score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'broken-links';

    try {
      const { html, siteConfig } = context;

      // Edge case: no HTML
      if (!html || html.trim().length === 0) {
        return {
          checkName,
          score: 100,
          passed: true,
          severity: 'warning',
          message: 'No HTML content to check for broken links.',
          details: {
            totalLinks: 0,
            validLinks: 0,
            invalidLinks: 0,
            internalLinks: 0,
            externalLinks: 0,
          },
        };
      }

      const links = extractAndValidateLinks(html, siteConfig.baseUrl);
      const totalLinks = links.length;

      // No links found — perfect score
      if (totalLinks === 0) {
        return {
          checkName,
          score: 100,
          passed: true,
          severity: 'warning',
          message: 'No links found in content.',
          details: {
            totalLinks: 0,
            validLinks: 0,
            invalidLinks: 0,
            internalLinks: 0,
            externalLinks: 0,
          },
        };
      }

      const validLinks = links.filter((l) => l.isValid);
      const invalidLinks = links.filter((l) => !l.isValid);
      const internalLinks = links.filter((l) => l.isInternal);
      const externalLinks = links.filter((l) => !l.isInternal);

      const score = Math.round((validLinks.length / totalLinks) * 100);
      const passed = score >= 80;

      let message: string;
      if (invalidLinks.length === 0) {
        message = `All ${totalLinks} links have valid format (${internalLinks.length} internal, ${externalLinks.length} external).`;
      } else {
        message = `${invalidLinks.length} of ${totalLinks} links have format issues.`;
      }

      const result: CheckResult = {
        checkName,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          totalLinks,
          validLinks: validLinks.length,
          invalidLinks: invalidLinks.length,
          internalLinks: internalLinks.length,
          externalLinks: externalLinks.length,
          invalidDetails: invalidLinks.slice(0, 10).map((l) => ({
            href: l.href || '(empty)',
            reason: l.invalidReason,
          })),
        },
      };

      if (!passed) {
        result.fixSuggestion =
          `Fix ${invalidLinks.length} link(s) with format issues: ` +
          invalidLinks
            .slice(0, 5)
            .map((l) => `"${l.href || '(empty)'}" — ${l.invalidReason}`)
            .join('; ') +
          (invalidLinks.length > 5 ? ` (and ${invalidLinks.length - 5} more)` : '') +
          '.';
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during broken links check';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Broken links check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the HTML is well-formed.',
      };
    }
  },
};
