/**
 * @module seo-auditor/checks/core-web-vitals
 * @description Estimates Core Web Vitals performance budget from static HTML analysis.
 * Checks DOM size, image optimization, render-blocking resources, and lazy loading.
 */

import type { CheckContext, CheckResult, PluginCheck } from '../../engine/types.js';
import { seoAuditorConfig } from '../config.js';

const CONFIG = seoAuditorConfig.checks.coreWebVitals;

/**
 * Counts the approximate number of DOM elements by counting opening tags.
 *
 * @param html - Full HTML source string.
 * @returns Approximate DOM element count.
 */
function countDomElements(html: string): number {
  const matches = html.match(/<[a-zA-Z][^>]*>/g);
  return matches ? matches.length : 0;
}

/**
 * Represents an image element extracted from HTML for analysis.
 */
interface ImageInfo {
  /** The src attribute value. */
  src: string;
  /** Whether width attribute is present. */
  hasWidth: boolean;
  /** Whether height attribute is present. */
  hasHeight: boolean;
  /** Whether the loading="lazy" attribute is set. */
  hasLazyLoading: boolean;
  /** Whether the image source hints at a large file size. */
  likelyLarge: boolean;
}

/**
 * Extracts image elements from HTML and analyses their attributes.
 *
 * @param html - Full HTML source string.
 * @returns Array of image info objects.
 */
function extractImages(html: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  const regex = /<img\s+([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1].trim() : '';

    const hasWidth = /width\s*=\s*["']\d+["']/i.test(attrs) || /width\s*:\s*\d+/i.test(attrs);
    const hasHeight = /height\s*=\s*["']\d+["']/i.test(attrs) || /height\s*:\s*\d+/i.test(attrs);
    const hasLazyLoading = /loading\s*=\s*["']lazy["']/i.test(attrs);

    // Heuristic: large file if the extension suggests uncompressed or very large format,
    // or if the filename hints at a large resolution.
    const likelyLarge =
      /\.(bmp|tiff?|psd)$/i.test(src) ||
      /(\d{4}x\d{4}|fullsize|original|uncompressed)/i.test(src) ||
      (!src.includes('.webp') && !src.includes('.avif') && /\.(png|jpg|jpeg)$/i.test(src) && /(hero|banner|background|full)/i.test(src));

    images.push({ src, hasWidth, hasHeight, hasLazyLoading, likelyLarge });
  }

  return images;
}

/**
 * Counts render-blocking CSS and JS resources in the &lt;head&gt; section.
 * CSS links without media="print" or disabled, and scripts without async/defer are blocking.
 *
 * @param html - Full HTML source string.
 * @returns Number of render-blocking resources.
 */
function countRenderBlockingResources(html: string): number {
  // Extract <head> content.
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    return 0;
  }
  const head = headMatch[1];
  let blockingCount = 0;

  // CSS: <link rel="stylesheet"> without media="print" or disabled.
  const cssRegex = /<link\s+[^>]*rel\s*=\s*["']stylesheet["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = cssRegex.exec(head)) !== null) {
    const tag = match[0];
    const hasPrintMedia = /media\s*=\s*["']print["']/i.test(tag);
    const isDisabled = /disabled/i.test(tag);
    if (!hasPrintMedia && !isDisabled) {
      blockingCount++;
    }
  }

  // JS: <script src="..."> without async or defer.
  const jsRegex = /<script\s+[^>]*src\s*=\s*["'][^"']+["'][^>]*>/gi;
  while ((match = jsRegex.exec(head)) !== null) {
    const tag = match[0];
    const hasAsync = /\basync\b/i.test(tag);
    const hasDefer = /\bdefer\b/i.test(tag);
    const isModule = /type\s*=\s*["']module["']/i.test(tag);
    if (!hasAsync && !hasDefer && !isModule) {
      blockingCount++;
    }
  }

  return blockingCount;
}

/**
 * PluginCheck that estimates Core Web Vitals compliance from static HTML.
 *
 * Scoring breakdown:
 * - **DOM size (30%)**: DOM element count is within budget.
 * - **Image optimization (30%)**: Images have dimensions and use modern formats.
 * - **Render-blocking (20%)**: No render-blocking CSS/JS in head.
 * - **Lazy loading (20%)**: Below-fold images use loading="lazy".
 *
 * @see seoAuditorConfig.checks.coreWebVitals
 */
export const coreWebVitalsCheck: PluginCheck = {
  name: 'core-web-vitals',
  description:
    'Estimates Core Web Vitals budget compliance: DOM size, image optimization, render-blocking resources, and lazy loading.',
  severity: 'warning',
  weight: CONFIG.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;
      const issues: string[] = [];

      /* ---------- DOM size (30 pts) ---------- */
      let domScore = 0;
      const domCount = countDomElements(html);
      if (domCount <= CONFIG.maxDomElements) {
        domScore = 30;
      } else {
        const overshoot = domCount - CONFIG.maxDomElements;
        const penalty = Math.min(30, Math.round((overshoot / CONFIG.maxDomElements) * 30));
        domScore = Math.max(0, 30 - penalty);
        issues.push(
          `Approximate DOM element count is ${domCount}; recommended maximum is ${CONFIG.maxDomElements}.`,
        );
      }

      /* ---------- Image optimization (30 pts) ---------- */
      let imageScore = 0;
      const images = extractImages(html);
      if (images.length === 0) {
        imageScore = 30;
      } else {
        let optimizedCount = 0;
        const imageIssues: string[] = [];

        for (const img of images) {
          let isOptimized = true;
          if (!img.hasWidth || !img.hasHeight) {
            isOptimized = false;
          }
          if (img.likelyLarge) {
            isOptimized = false;
          }
          if (isOptimized) {
            optimizedCount++;
          }
        }

        const withoutDimensions = images.filter((i) => !i.hasWidth || !i.hasHeight);
        if (withoutDimensions.length > 0) {
          imageIssues.push(
            `${withoutDimensions.length} image(s) missing explicit width/height attributes.`,
          );
        }

        const largeImages = images.filter((i) => i.likelyLarge);
        if (largeImages.length > 0) {
          imageIssues.push(
            `${largeImages.length} image(s) likely exceed ${CONFIG.maxImageSizeKb}KB or use unoptimized formats.`,
          );
        }

        const ratio = optimizedCount / images.length;
        imageScore = Math.round(ratio * 30);
        issues.push(...imageIssues);
      }

      /* ---------- Render-blocking (20 pts) ---------- */
      let renderBlockingScore = 0;
      const blockingCount = countRenderBlockingResources(html);
      if (blockingCount === 0) {
        renderBlockingScore = 20;
      } else if (blockingCount <= 2) {
        renderBlockingScore = 12;
        issues.push(
          `${blockingCount} render-blocking resource(s) in <head>. Use async/defer for scripts and media queries for CSS.`,
        );
      } else {
        renderBlockingScore = Math.max(0, 20 - blockingCount * 3);
        issues.push(
          `${blockingCount} render-blocking resources in <head>. This may significantly delay rendering.`,
        );
      }

      /* ---------- Lazy loading (20 pts) ---------- */
      let lazyLoadingScore = 0;
      if (images.length === 0) {
        lazyLoadingScore = 20;
      } else {
        // First image is likely above-fold; remaining should be lazy-loaded.
        const belowFoldImages = images.slice(1);
        if (belowFoldImages.length === 0) {
          lazyLoadingScore = 20;
        } else {
          const lazyCount = belowFoldImages.filter((i) => i.hasLazyLoading).length;
          const lazyRatio = lazyCount / belowFoldImages.length;
          lazyLoadingScore = Math.round(lazyRatio * 20);
          if (lazyRatio < 1) {
            const missingLazy = belowFoldImages.length - lazyCount;
            issues.push(
              `${missingLazy} below-fold image(s) missing loading="lazy" attribute.`,
            );
          }
        }
      }

      const totalScore = domScore + imageScore + renderBlockingScore + lazyLoadingScore;
      const passed = totalScore >= seoAuditorConfig.threshold;

      return {
        checkName: 'core-web-vitals',
        score: totalScore,
        passed,
        severity: 'warning',
        message:
          issues.length === 0
            ? 'Core Web Vitals estimation passes all checks.'
            : issues.join(' '),
        details: {
          domElementCount: domCount,
          maxDomElements: CONFIG.maxDomElements,
          imageCount: images.length,
          renderBlockingResources: blockingCount,
          domScore,
          imageScore,
          renderBlockingScore,
          lazyLoadingScore,
        },
        fixSuggestion:
          totalScore < 100
            ? 'Reduce DOM size, add width/height to images, use async/defer for scripts, and add loading="lazy" to below-fold images.'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        checkName: 'core-web-vitals',
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Core Web Vitals check failed unexpectedly: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion:
          'Investigate the HTML structure — the Core Web Vitals check encountered an internal error.',
      };
    }
  },
};
