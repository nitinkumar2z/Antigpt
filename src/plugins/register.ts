/**
 * @fileoverview Production plugin registration, validation, and activation.
 *
 * This module is the single entry point for bootstrapping the entire plugin layer.
 * It registers all nine production plugins, creates the persistence layer (SQLite),
 * records the architecture in the Memory Graph, and activates the plugins.
 *
 * @module plugins/register
 * @version 2.0.0
 */

import { pluginLifecycleManager } from './engine/lifecycle.js';
import { pluginRegistry } from './engine/registry.js';
import { pluginExecutor } from './engine/executor.js';
import { pluginEventBus } from './engine/events.js';

// ─── Plugin Imports (ordered by execution priority) ────────────────────────────
import { qualityGatekeeperPlugin } from './quality-gatekeeper/index.js';
import { seoAuditorPlugin } from './seo-auditor/index.js';
import { aeoAuditorPlugin } from './aeo-auditor/index.js';
import { toolResearchEnginePlugin } from './tool-research-engine/index.js';
import { toolPlannerPlugin } from './tool-planner/index.js';
import { qaAutomationPlugin } from './qa-automation/index.js';
import { deploymentGuardianPlugin } from './deployment-guardian/index.js';
import { googleUpdateEnginePlugin } from './google-update-engine/index.js';
import { weeklySeoEnginePlugin } from './weekly-seo-engine/index.js';

import type {
  PluginDefinition,
  PluginInstance,
  PluginEvent,
  PluginExecutionResult,
  CheckContext,
  PluginHook,
} from './engine/types.js';

// ─── Production Plugin Manifest ────────────────────────────────────────────────

/**
 * Ordered list of all production plugins. Order matters:
 * 1. Quality Gatekeeper (pre-publish gate, 0-1000 scale, blocks < 800)
 * 2. SEO Compliance Auditor (post-build audit)
 * 3. AEO Compliance Auditor (post-build audit)
 * 4. Tool Research Engine (pre-publish research validation)
 * 5. Tool Planner (pre-publish architecture validation)
 * 6. QA Automation (post-build + pre-publish testing)
 * 7. Deployment Guardian (pre-publish deployment safety)
 * 8. Google Update Response Engine (on-schedule monitoring)
 * 9. Weekly SEO Operations Engine (on-schedule operations)
 */
const PRODUCTION_PLUGINS: readonly PluginDefinition[] = [
  qualityGatekeeperPlugin,
  seoAuditorPlugin,
  aeoAuditorPlugin,
  toolResearchEnginePlugin,
  toolPlannerPlugin,
  qaAutomationPlugin,
  deploymentGuardianPlugin,
  googleUpdateEnginePlugin,
  weeklySeoEnginePlugin,
] as const;

/**
 * MCP server dependency map — which servers each plugin requires.
 * Used for dependency validation during registration.
 */
const MCP_SERVER_REGISTRY: ReadonlySet<string> = new Set([
  'context7',
  'fetch',
  'memory',
  'postgres',
  'sqlite',
  'playwright',
  'cloudflare',
  'github',
]);

// ─── Registration Report ───────────────────────────────────────────────────────

/** Structured report from the registration process. */
export interface RegistrationReport {
  /** Total plugins attempted. */
  totalPlugins: number;
  /** Successfully registered and activated plugin names. */
  activatedPlugins: string[];
  /** Plugins that failed registration, with error messages. */
  failedPlugins: Array<{ name: string; error: string }>;
  /** Total number of checks loaded across all active plugins. */
  totalChecks: number;
  /** Hook bindings: which plugins fire on which hooks. */
  hookBindings: Record<string, string[]>;
  /** MCP dependency map: plugin → required MCP servers. */
  mcpDependencies: Record<string, string[]>;
  /** ISO 8601 timestamp of registration completion. */
  registeredAt: string;
  /** Duration of the entire registration process in milliseconds. */
  durationMs: number;
}

// ─── Event Logging ─────────────────────────────────────────────────────────────

/**
 * Attaches a structured logger to the plugin event bus.
 * All plugin events are logged to stdout in a structured JSON format
 * suitable for log aggregation (Cloudflare Logpush, etc.).
 */
function attachEventLogger(): void {
  pluginEventBus.onAny((event: PluginEvent) => {
    const logEntry = {
      level: event.type.includes('error') ? 'error' : 'info',
      component: 'plugin-system',
      event: event.type,
      plugin: event.pluginName,
      timestamp: event.timestamp,
      ...event.data,
    };
    console.log(JSON.stringify(logEntry));
  });
}

// ─── Dependency Validation ─────────────────────────────────────────────────────

/**
 * Validates that all declared MCP dependencies reference known servers.
 *
 * @param plugin - The plugin definition to validate.
 * @returns Array of missing MCP server names (empty = all satisfied).
 */
function validateMcpDependencies(plugin: PluginDefinition): string[] {
  const deps = plugin.mcpDependencies ?? [];
  return deps.filter((dep) => !MCP_SERVER_REGISTRY.has(dep));
}

// ─── Registration ──────────────────────────────────────────────────────────────

/**
 * Registers, validates, and activates all production plugins.
 *
 * This function is idempotent — calling it multiple times will skip
 * already-registered plugins. It performs the following steps:
 *
 * 1. Attaches the structured event logger
 * 2. Initializes the plugin lifecycle manager
 * 3. Validates MCP dependencies for each plugin
 * 4. Registers each plugin definition (with schema validation)
 * 5. Activates each successfully registered plugin
 * 6. Returns a structured registration report
 *
 * @returns A promise resolving to a RegistrationReport
 */
export async function registerProductionPlugins(): Promise<RegistrationReport> {
  const startTime = performance.now();

  // Step 1: Attach observability
  attachEventLogger();

  // Step 2: Initialize lifecycle (creates SQLite tables, etc.)
  await pluginLifecycleManager.initialize();

  // Step 3-5: Register + validate + activate each plugin
  const activatedPlugins: string[] = [];
  const failedPlugins: Array<{ name: string; error: string }> = [];
  const mcpDependencies: Record<string, string[]> = {};
  let totalChecks = 0;

  for (const pluginDef of PRODUCTION_PLUGINS) {
    try {
      // Skip if already registered and active
      if (pluginRegistry.isRegistered(pluginDef.name)) {
        const existing = pluginRegistry.get(pluginDef.name);
        if (existing && existing.status === 'active') {
          activatedPlugins.push(pluginDef.name);
          totalChecks += pluginDef.checks.length;
          mcpDependencies[pluginDef.name] = pluginDef.mcpDependencies ?? [];
          continue;
        }
      }

      // Validate MCP dependencies
      const missingDeps = validateMcpDependencies(pluginDef);
      if (missingDeps.length > 0) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            component: 'plugin-registration',
            plugin: pluginDef.name,
            message: `MCP dependencies not in registry: [${missingDeps.join(', ')}]`,
            timestamp: new Date().toISOString(),
          })
        );
        // Warn but don't block — MCP servers may come online later
      }

      // Register and activate
      await pluginLifecycleManager.registerAndActivate(pluginDef);
      activatedPlugins.push(pluginDef.name);
      totalChecks += pluginDef.checks.length;
      mcpDependencies[pluginDef.name] = pluginDef.mcpDependencies ?? [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedPlugins.push({ name: pluginDef.name, error: errorMessage });
      console.error(
        JSON.stringify({
          level: 'error',
          component: 'plugin-registration',
          plugin: pluginDef.name,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  // Step 6: Build hook binding map
  const hookBindings: Record<string, string[]> = {};
  const allHooks: PluginHook[] = ['pre-publish', 'post-build', 'on-schedule'];
  for (const hook of allHooks) {
    const bound = pluginRegistry.getByHook(hook);
    hookBindings[hook] = bound.map((p) => p.definition.name);
  }

  const durationMs = Math.round(performance.now() - startTime);

  const report: RegistrationReport = {
    totalPlugins: PRODUCTION_PLUGINS.length,
    activatedPlugins,
    failedPlugins,
    totalChecks,
    hookBindings,
    mcpDependencies,
    registeredAt: new Date().toISOString(),
    durationMs,
  };

  // Log the final report
  console.log(
    JSON.stringify({
      level: 'info',
      component: 'plugin-registration',
      event: 'registration-complete',
      report,
    })
  );

  return report;
}

// ─── Convenience Executors ─────────────────────────────────────────────────────

import { systemGovernor } from './engine/governor.js';

/**
 * Execute the pre-publish hook (Quality Gatekeeper, Tool Research, Tool Planner, QA, Deployment Guardian).
 * Returns true if content should be published, false if blocked.
 */
export async function executePrePublish(
  context: CheckContext
): Promise<{ approved: boolean; results: PluginExecutionResult[] }> {
  const results = await pluginExecutor.executeHook('pre-publish', context);
  const approved = results.every((r) => r.passed);
  
  // Apply the Green/Yellow/Red publish gates
  systemGovernor.evaluatePublishGates(results);
  
  return { approved, results };
}

/**
 * Execute the post-build hook (SEO Auditor, AEO Auditor, QA Automation, Google Update Engine).
 */
export async function executePostBuild(
  context: CheckContext
): Promise<PluginExecutionResult[]> {
  return pluginExecutor.executeHook('post-build', context);
}

/**
 * Execute the on-schedule hook (all monitoring plugins).
 */
export async function executeScheduled(
  context: CheckContext
): Promise<Map<string, PluginExecutionResult>> {
  return pluginExecutor.executeAll(context);
}

/**
 * Get the current health status of the plugin system.
 */
export function getPluginHealth() {
  return pluginLifecycleManager.getHealthReport();
}

// ─── Re-exports ────────────────────────────────────────────────────────────────

export { pluginRegistry } from './engine/registry.js';
export { pluginExecutor } from './engine/executor.js';
export { pluginEventBus } from './engine/events.js';
export { pluginLifecycleManager } from './engine/lifecycle.js';

// Plugin exports
export { qualityGatekeeperPlugin } from './quality-gatekeeper/index.js';
export { seoAuditorPlugin } from './seo-auditor/index.js';
export { aeoAuditorPlugin } from './aeo-auditor/index.js';
export { toolResearchEnginePlugin } from './tool-research-engine/index.js';
export { toolPlannerPlugin } from './tool-planner/index.js';
export { qaAutomationPlugin } from './qa-automation/index.js';
export { deploymentGuardianPlugin } from './deployment-guardian/index.js';
export { googleUpdateEnginePlugin } from './google-update-engine/index.js';
export { weeklySeoEnginePlugin } from './weekly-seo-engine/index.js';

// Type exports
export type {
  PluginDefinition,
  PluginInstance,
  PluginEvent,
  PluginExecutionResult,
  CheckContext,
  CheckResult,
  PluginHook,
  PluginCheck,
  PageMetadata,
  SiteConfig,
} from './engine/types.js';
