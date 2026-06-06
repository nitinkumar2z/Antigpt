/**
 * @fileoverview Cloudflare validation check for the Deployment Guardian plugin.
 * @module plugins/deployment-guardian/checks/cloudflare-validation
 */

import type { PluginCheck, CheckResult, CheckContext } from '../../engine/types.js';
import { deploymentGuardianConfig } from '../config.js';

const cfg = deploymentGuardianConfig.checks.cloudflareValidation;

/**
 * Validates Cloudflare Pages/Workers deployment readiness.
 *
 * Checks CDN-friendly patterns, edge compatibility, security headers,
 * and proper static asset organization.
 */
export const cloudflareValidationCheck: PluginCheck = {
  name: 'cloudflare-validation',
  description: 'Validates Cloudflare deployment readiness including CDN patterns, edge compatibility, security headers, and asset organization.',
  severity: 'critical',
  weight: cfg.weight,

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const { html } = context;

      // 1. CDN-friendly (25%) — content-hashed asset references
      const assetRefs = html.match(/(?:src|href)\s*=\s*["'][^"']*\.[a-f0-9]{8,}\.[^"']+["']/gi) || [];
      const hasVersionedAssets = assetRefs.length > 0 || /\?v=\d/i.test(html);
      const cdnScore = hasVersionedAssets ? 100 : 50;

      // 2. Edge-compatible (25%) — no server-side patterns in inline scripts
      const inlineScripts = html.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || [];
      let edgeClean = true;
      for (const script of inlineScripts) {
        if (/\brequire\s*\(/.test(script) || /process\.env/.test(script) || /\b__dirname\b/.test(script)) {
          edgeClean = false;
          break;
        }
      }
      const edgeScore = edgeClean ? 100 : 0;

      // 3. Security headers (25%) — CSP or X-Frame-Options meta
      const hasCsp = /<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html);
      const hasXfo = /<meta[^>]*http-equiv\s*=\s*["']X-Frame-Options["']/i.test(html);
      const securitySignals = (hasCsp ? 1 : 0) + (hasXfo ? 1 : 0);
      const securityScore = Math.round((securitySignals / 2) * 100);

      // 4. Asset organization (25%) — CSS/JS/images use proper paths
      const allAssets = html.match(/(?:src|href)\s*=\s*["']([^"']+)["']/gi) || [];
      let properPaths = 0;
      for (const asset of allAssets) {
        const url = asset.match(/["']([^"']+)["']/)?.[1] || '';
        if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:') || url.startsWith('#') || url.startsWith('mailto:')) {
          properPaths++;
        }
      }
      const assetScore = allAssets.length > 0 ? Math.round((properPaths / allAssets.length) * 100) : 100;
      
      // 5. Required Verification Tags (20% weight, 100 if all present)
      const hasAnalytics = /gtag|google-analytics|ga\.js|analytics\.js|googletagmanager|beacon\.min\.js/i.test(html);
      const hasSearchConsole = /<meta[^>]*name\s*=\s*["']google-site-verification["']/i.test(html);
      const hasAdsense = /adsbygoogle|pagead2\.googlesyndication|google-adsense|ca-pub-/i.test(html);

      const verificationSignals = (hasAnalytics ? 1 : 0) + (hasSearchConsole ? 1 : 0) + (hasAdsense ? 1 : 0);
      const verificationScore = Math.round((verificationSignals / 3) * 100);

      const score = Math.round(
        cdnScore * 0.20 + edgeScore * 0.20 + securityScore * 0.20 + assetScore * 0.20 + verificationScore * 0.20
      );
      const passed = score >= 60 && verificationSignals === 3;

      return {
        checkName: 'cloudflare-validation',
        score,
        passed,
        severity: 'critical',
        message: passed
          ? `Cloudflare validation passed (${score}/100). Deployment ready with Analytics, Search Console, and AdSense.`
          : `Cloudflare validation issues (${score}/100). Missing mandatory verification scripts or tags (Analytics: ${hasAnalytics}, GSC: ${hasSearchConsole}, AdSense: ${hasAdsense}).`,
        details: { cdnScore, edgeScore, securityScore, assetScore, verificationScore, totalAssets: allAssets.length },
        fixSuggestion: !passed
          ? 'Ensure Analytics is installed, Google Search Console verification meta tag is present, and AdSense script is configured.'
          : undefined,
      };
    } catch (error: unknown) {
      return {
        checkName: 'cloudflare-validation',
        score: 0,
        passed: false,
        severity: 'critical',
        message: `Cloudflare validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
