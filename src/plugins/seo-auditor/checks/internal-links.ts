/**
 * @module seo-auditor/checks/internal-links
 * @description Validates internal linking strategy for SEO compliance.
 * Checks link count, contextual placement, and descriptive anchor text.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.internalLinks;

/**
 * Anchor texts considered non-descriptive / generic for SEO purposes.
 * Compared case-insensitively after trimming.
 */
const GENERIC_ANCHOR_TEXTS: ReadonlySet<string> = new Set([
  'click here',
  'here',
  'read more',
  'link',
  'more',
  'learn more',
  'this',
  'continue',
  'go',
  'see more',
  'details',
  'more info',
  'info',
  'click',
  'source',
]);

/**
 * Represents a single anchor link extracted from HTML.
 */
interface LinkEntry {
  /** The raw href attribute value. */
  href: string;
  /** The trimmed anchor text (inner HTML tags stripped). */
  anchorText: string;
  /** Whether the link is placed inside a contextual content container. */
  isContextual: boolean;
  /** Whether the link points to an internal resource. */
  isInternal: boolean;
}

/**
 * Determines whether an href is internal to the site.
 * Internal links are relative paths or absolute URLs sharing the same hostname.
 *
 * @param href - The href attribute value.
 * @param baseUrl - The site's base URL from configuration.
 * @returns `true` if the link is internal.
 */
function isInternalLink(href: string, baseUrl: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('javascript:')) {
    return false;
  }
  // Relative URLs are internal.
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const linkHost = new URL(trimmed).hostname.toLowerCase();
    const siteHost = new URL(baseUrl).hostname.toLowerCase();
    return linkHost === siteHost || linkHost.endsWith(`.${siteHost}`);
  } catch {
    return false;
  }
}

/**
 * Strips HTML sections that are navigational rather than content.
 * Returns only the content inside &lt;main&gt;, &lt;article&gt;, or &lt;p&gt; tags.
 *
 * @param html - Full HTML source string.
 * @returns Concatenated content from contextual containers.
 */
function extractContextualHtml(html: string): string {
  const containers: string[] = [];

  // Extract <main>...</main>
  const mainRegex = /<main\b[^>]*>([\s\S]*?)<\/main>/gi;
  let match: RegExpExecArray | null;
  while ((match = mainRegex.exec(html)) !== null) {
    containers.push(match[1]);
  }

  // Extract <article>...</article>
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  while ((match = articleRegex.exec(html)) !== null) {
    containers.push(match[1]);
  }

  // If no main/article containers, fall back to <p> tags.
  if (containers.length === 0) {
    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(html)) !== null) {
      containers.push(match[1]);
    }
  }

  return containers.join('\n');
}

/**
 * Extracts all anchor links from the HTML.
 *
 * @param html - Full HTML source string.
 * @param contextualHtml - HTML from contextual containers only.
 * @param baseUrl - The site's base URL for internal link classification.
 * @returns Array of link entries.
 */
function extractLinks(html: string, contextualHtml: string, baseUrl: string): LinkEntry[] {
  const links: LinkEntry[] = [];
  const regex = /<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1].trim();
    const anchorText = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const fullTag = match[0];
    const isContextual = contextualHtml.includes(fullTag);
    const internal = isInternalLink(href, baseUrl);

    links.push({
      href,
      anchorText,
      isContextual,
      isInternal: internal,
    });
  }

  return links;
}

/**
 * PluginCheck that validates the page's internal linking strategy for SEO.
 *
 * Scoring breakdown:
 * - **Count met (40%)**: Minimum internal links threshold reached.
 * - **Contextual placement (30%)**: Internal links appear inside main content.
 * - **Descriptive anchors (30%)**: Anchor texts are descriptive, not generic.
 *
 * @see seoAuditorConfig.checks.internalLinks
 */
export const internalLinksCheck: PluginCheck = {
  name: 'internal-links',
  description:
    'Validates internal linking for adequate count, contextual placement, and descriptive anchor text.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html, siteConfig } = context;
      const contextualHtml = extractContextualHtml(html);
      const allLinks = extractLinks(html, contextualHtml, siteConfig.baseUrl);
      const internalLinks = allLinks.filter((l) => l.isInternal);
      const issues: string[] = [];

      /* ---------- Count met (40 pts) ---------- */
      let countScore = 0;
      const internalCount = internalLinks.length;
      if (internalCount >= CONFIG.minLinks) {
        countScore = 40;
      } else if (internalCount > 0) {
        countScore = Math.round((internalCount / CONFIG.minLinks) * 40);
        issues.push(
          `Found ${internalCount} internal link(s); minimum recommended is ${CONFIG.minLinks}.`,
        );
      } else {
        issues.push('No internal links found on the page.');
      }

      /* ---------- Contextual placement (30 pts) ---------- */
      let contextualScore = 0;
      if (internalLinks.length > 0) {
        const contextualInternalLinks = internalLinks.filter((l) => l.isContextual);
        const contextualRatio = contextualInternalLinks.length / internalLinks.length;
        contextualScore = Math.round(contextualRatio * 30);
        if (contextualRatio < 0.5) {
          issues.push(
            `Only ${Math.round(contextualRatio * 100)}% of internal links are in contextual content (main/article/p). Place links within body content.`,
          );
        }
      }

      /* ---------- Descriptive anchors (30 pts) ---------- */
      let descriptiveScore = 0;
      if (internalLinks.length > 0) {
        const descriptiveLinks = internalLinks.filter((l) => {
          const lower = l.anchorText.toLowerCase().trim();
          return lower.length > 0 && !GENERIC_ANCHOR_TEXTS.has(lower);
        });
        const descriptiveRatio = descriptiveLinks.length / internalLinks.length;
        descriptiveScore = Math.round(descriptiveRatio * 30);
        const genericCount = internalLinks.length - descriptiveLinks.length;
        if (genericCount > 0) {
          issues.push(
            `${genericCount} internal link(s) use generic anchor text (e.g. "click here", "read more"). Use descriptive anchor text.`,
          );
        }
      }

      const totalScore = countScore + contextualScore + descriptiveScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'internal-links',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Internal linking passes all SEO checks.'
            : issues.join(' '),
        details: {
          totalLinks: allLinks.length,
          internalLinkCount: internalCount,
          externalLinkCount: allLinks.filter((l) => !l.isInternal).length,
          contextualInternalLinks: internalLinks.filter((l) => l.isContextual).length,
          countScore,
          contextualScore,
          descriptiveScore,
        },
        fixSuggestion:
          totalScore < 100
            ? `Add at least ${CONFIG.minLinks} internal links with descriptive anchor text inside the main content area.`
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'internal-links',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Internal links check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the internal links check encountered an internal error.',
      };
    }
  },
};
