/**
 * @fileoverview Deployment Guardian plugin entry point.
 * @module plugins/deployment-guardian
 */

import type { PluginDefinition } from '../engine/types.js';
import { deploymentGuardianConfig } from './config.js';
import { githubValidationCheck } from './checks/github-validation.js';
import { cloudflareValidationCheck } from './checks/cloudflare-validation.js';
import { rollbackValidationCheck } from './checks/rollback-validation.js';

/**
 * Deployment Guardian plugin definition.
 *
 * Validates deployment readiness through GitHub CI/CD checks,
 * Cloudflare Pages/Workers compatibility, and rollback safety.
 */
export const deploymentGuardianPlugin: PluginDefinition = {
  name: 'deployment-guardian',
  version: '1.0.0',
  description: 'Validates deployment readiness through GitHub, Cloudflare, and rollback safety checks.',
  hooks: ['pre-publish'],
  failureMode: deploymentGuardianConfig.failureMode,
  threshold: deploymentGuardianConfig.threshold,
  mcpDependencies: ['github', 'cloudflare'],
  checks: [
    githubValidationCheck,
    cloudflareValidationCheck,
    rollbackValidationCheck,
  ],
};
