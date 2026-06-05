/**
 * @fileoverview Image alt-text check for the Quality Gatekeeper plugin.
 *
 * Verifies that every `<img>` tag in the HTML has a high-quality `alt` attribute.
 * A "good" alt text must:
 * 1. Be present and non-empty.
 * 2. Not look like a raw filename (e.g., "IMG_001.jpg", "photo-2.png").
 * 3. Contain at least 4 words to be meaningfully descriptive.
 *
 * The score is the ratio of images with good alt text to total images,
 * scaled to 0-100.  Pages with no images automatically score 100.
 */

import type { PluginCheck, CheckContext, CheckResult } from '../../engine/types.js';
import { qualityGatekeeperConfig } from '../config.js';

const config = qualityGatekeeperConfig.checks.altText;

/**
 * Regex to extract `<img>` tags from HTML.
 * Captures the full tag so we can inspect its attributes.
 */
const IMG_TAG_REGEX = /<img\s[^>]*?>/gi;

/**
 * Regex to extract the alt attribute value from an img tag.
 * Supports double-quoted, single-quoted, and unquoted values.
 */
const ALT_ATTR_REGEX = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i;

/**
 * Regex patterns that indicate an alt text is just a filename.
 * Matches common image filename patterns like "IMG_001.jpg", "photo-2.png", "DSC1234.jpeg".
 */
const FILENAME_PATTERNS: readonly RegExp[] = [
  /^[A-Z]{2,}_?\d+\.[a-z]{3,4}$/i,           // IMG_001.jpg, DSC1234.png
  /^\d+\.[a-z]{3,4}$/i,                        // 001.jpg
  /^[a-z0-9_-]+\.[a-z]{3,4}$/i,                // photo-2.png, my_image.webp
  /^image\s*\d*\.[a-z]{3,4}$/i,                // image.jpg, image1.png
  /^screenshot[_-]?\d*\.[a-z]{3,4}$/i,         // screenshot.png, screenshot-1.jpg
  /^photo[_-]?\d*\.[a-z]{3,4}$/i,              // photo.jpg, photo_1.png
  /^untitled[_-]?\d*\.[a-z]{3,4}$/i,           // untitled.png
  /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|avif)$/i, // anything ending in image extension
];

/** Minimum word count for alt text to be considered descriptive. */
const MIN_ALT_WORDS = 4;

/**
 * Classification of an individual image's alt text quality.
 */
interface AltTextAssessment {
  /** The raw alt attribute value, or null if missing. */
  altText: string | null;
  /** Whether the alt text passes quality standards. */
  isGood: boolean;
  /** Reason for failure, if applicable. */
  failureReason?: string;
}

/**
 * Determine whether an alt text value looks like a raw filename.
 *
 * @param alt - The alt text string to evaluate.
 * @returns True if the alt text matches a filename pattern.
 */
function looksLikeFilename(alt: string): boolean {
  const trimmed = alt.trim();
  return FILENAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Assess the quality of a single image's alt text.
 *
 * @param imgTag - The full `<img>` HTML tag string.
 * @returns Assessment of the alt text quality.
 */
function assessAltText(imgTag: string): AltTextAssessment {
  const match = imgTag.match(ALT_ATTR_REGEX);

  // No alt attribute at all
  if (!match) {
    return {
      altText: null,
      isGood: false,
      failureReason: 'Missing alt attribute',
    };
  }

  const altValue = (match[1] ?? match[2] ?? match[3] ?? '').trim();

  // Empty alt attribute: intentionally empty alt="" is valid for decorative images,
  // but we still flag it as suboptimal for SEO purposes.
  if (altValue.length === 0) {
    return {
      altText: '',
      isGood: false,
      failureReason: 'Empty alt attribute',
    };
  }

  // Looks like a filename
  if (looksLikeFilename(altValue)) {
    return {
      altText: altValue,
      isGood: false,
      failureReason: `Alt text appears to be a filename: "${altValue}"`,
    };
  }

  // Too few words
  const wordCount = altValue.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < MIN_ALT_WORDS) {
    return {
      altText: altValue,
      isGood: false,
      failureReason: `Alt text too short (${wordCount} words; minimum ${MIN_ALT_WORDS}): "${altValue}"`,
    };
  }

  return {
    altText: altValue,
    isGood: true,
  };
}

/**
 * Alt text plugin check.
 *
 * Scans all `<img>` tags in the HTML and evaluates whether each has a
 * descriptive, non-filename alt attribute of sufficient length.
 */
export const altTextCheck: PluginCheck = {
  name: 'alt-text',
  description:
    'Verifies that all images have descriptive alt text — not empty, not a filename, and at least 4 words long.',
  severity: 'warning',
  weight: config.weight,

  /**
   * Execute the alt text check.
   *
   * @param context - The check context containing HTML.
   * @returns A CheckResult with the alt text quality score and diagnostics.
   */
  async execute(context: CheckContext): Promise<CheckResult> {
    const checkName = 'alt-text';

    try {
      const { html } = context;

      // Edge case: no HTML
      if (!html || html.trim().length === 0) {
        return {
          checkName,
          score: 100,
          passed: true,
          severity: 'warning',
          message: 'No HTML content to check for image alt text.',
          details: { totalImages: 0, goodAlt: 0, badAlt: 0 },
        };
      }

      // Extract all <img> tags
      IMG_TAG_REGEX.lastIndex = 0;
      const imgTags: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = IMG_TAG_REGEX.exec(html)) !== null) {
        imgTags.push(match[0]);
      }

      // No images found — perfect score
      if (imgTags.length === 0) {
        return {
          checkName,
          score: 100,
          passed: true,
          severity: 'warning',
          message: 'No images found in content.',
          details: { totalImages: 0, goodAlt: 0, badAlt: 0 },
        };
      }

      const assessments = imgTags.map(assessAltText);
      const goodCount = assessments.filter((a) => a.isGood).length;
      const badCount = assessments.filter((a) => !a.isGood).length;
      const totalImages = assessments.length;

      const score = Math.round((goodCount / totalImages) * 100);
      const passed = score >= 80;

      let message: string;
      if (badCount === 0) {
        message = `All ${totalImages} images have good alt text.`;
      } else {
        message = `${badCount} of ${totalImages} images have missing or inadequate alt text.`;
      }

      const badDetails = assessments
        .filter((a) => !a.isGood)
        .slice(0, 10)
        .map((a) => ({
          altText: a.altText ?? '(missing)',
          reason: a.failureReason,
        }));

      const result: CheckResult = {
        checkName,
        score,
        passed,
        severity: 'warning',
        message,
        details: {
          totalImages,
          goodAlt: goodCount,
          badAlt: badCount,
          issues: badDetails,
        },
      };

      if (!passed) {
        result.fixSuggestion =
          `Add descriptive alt text (at least ${MIN_ALT_WORDS} words) to ${badCount} image(s). ` +
          'Alt text should describe the image content meaningfully — avoid filenames and generic labels.';
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during alt text check';
      return {
        checkName,
        score: 0,
        passed: false,
        severity: 'warning',
        message: `Alt text check failed: ${errorMessage}`,
        details: { error: errorMessage },
        fixSuggestion: 'Investigate the error and ensure the HTML is well-formed.',
      };
    }
  },
};
