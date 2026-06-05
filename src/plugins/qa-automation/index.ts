/**
 * @fileoverview QA Automation plugin entry point.
 * @module plugins/qa-automation
 */

import type { PluginDefinition } from '../engine/types.js';
import { qaAutomationConfig } from './config.js';
import { playwrightValidationCheck } from './checks/playwright-validation.js';
import { accessibilityCheck } from './checks/accessibility.js';
import { functionalTestingCheck } from './checks/functional-testing.js';

/**
 * QA Automation plugin definition.
 *
 * Validates page quality through rendering readiness checks,
 * WCAG accessibility compliance, and functional integrity testing.
 */
export const qaAutomationPlugin: PluginDefinition = {
  name: 'qa-automation',
  version: '1.0.0',
  description: 'Validates page quality through rendering checks, accessibility compliance, and functional testing.',
  hooks: ['post-build', 'pre-publish'],
  failureMode: qaAutomationConfig.failureMode,
  threshold: qaAutomationConfig.threshold,
  mcpDependencies: ['playwright'],
  checks: [
    playwrightValidationCheck,
    accessibilityCheck,
    functionalTestingCheck,
  ],
};
