/**
 * @file System Governor Lite framework.
 * @module plugins/engine/governor
 *
 * The Governor enforces policies on the plugin execution engine:
 * 1. Dependency Access Control: Prevents unapproved plugins from requesting sensitive MCP servers.
 * 2. Execution Time Budgeting: Tracks and caps total time spent in checks to prevent CPU/IO exhaustion.
 * 3. Configuration Safety: Enforces limits on timeout thresholds and weight splits.
 * 4. Observability: Emits policy warnings through the shared event bus.
 */

import type {
  PluginDefinition,
  PluginInstance,
  PluginExecutionResult,
  CheckContext,
  PluginHook,
} from './types.js';
import { pluginEventBus } from './events.js';
import { pluginRegistry } from './registry.js';

/** Policy definition for the System Governor. */
export interface GovernorPolicy {
  /** Maximum execution time allowed for a single plugin in milliseconds. Default: 30,000ms. */
  maxExecutionTimeMs: number;
  /** Maximum cumulative execution time budget for a single request sequence. Default: 60,000ms. */
  maxSequenceBudgetMs: number;
  /** Approved mapping of plugins allowed to access sensitive MCP servers. */
  mcpAccessWhiteList: Record<string, string[]>;
}

/** Default governor policy options. */
const DEFAULT_POLICY: GovernorPolicy = {
  maxExecutionTimeMs: 30_000,
  maxSequenceBudgetMs: 90_000,
  mcpAccessWhiteList: {
    github: ['deployment-guardian'],
    cloudflare: ['deployment-guardian'],
    postgres: ['tool-planner', 'weekly-seo-engine'],
  },
};

export class SystemGovernor {
  private policy: GovernorPolicy;
  private timeSpentMs: number = 0;

  constructor(policy: Partial<GovernorPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  /**
   * Returns the currently active policy settings.
   */
  getPolicy(): GovernorPolicy {
    return this.policy;
  }

  /**
   * Updates the governor's policy settings.
   */
  updatePolicy(newPolicy: Partial<GovernorPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
  }

  /**
   * Resets the cumulative execution budget (typically called at the start of a pipeline run).
   */
  resetBudget(): void {
    this.timeSpentMs = 0;
  }

  /**
   * Validates a plugin definition before registration.
   * Ensures the plugin does not violate security access lists or weight allocations.
   *
   * @param definition - The plugin definition to audit.
   * @throws {Error} If a policy violation is detected.
   */
  auditDefinition(definition: PluginDefinition): void {
    // 1. Audit MCP access control
    const deps = definition.mcpDependencies ?? [];
    for (const dep of deps) {
      const allowedPlugins = this.policy.mcpAccessWhiteList[dep];
      // If a dependency is restricted and the plugin is not in the whitelist, block it
      if (allowedPlugins && !allowedPlugins.includes(definition.name)) {
        const errorMsg = `Security Violation: Plugin "${definition.name}" is not authorized to access restricted MCP server "${dep}".`;
        this.emitViolation(definition.name, 'security_restriction', errorMsg);
        throw new Error(errorMsg);
      }
    }

    // 2. Audit check weights (must sum to 100 or be proportional)
    const totalWeight = definition.checks.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0 && definition.checks.length > 0) {
      const errorMsg = `Configuration Violation: Plugin "${definition.name}" defines checks but cumulative weight is 0.`;
      this.emitViolation(definition.name, 'config_invalid', errorMsg);
      throw new Error(errorMsg);
    }

    // 3. Audit execution hook constraints
    if (definition.hooks.length === 0) {
      const errorMsg = `Configuration Violation: Plugin "${definition.name}" is not bound to any execution hook.`;
      this.emitViolation(definition.name, 'config_invalid', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Pre-execution governor audit. Checks sequence budget limits before running a plugin.
   *
   * @param pluginName - Name of the plugin.
   * @param hook - Hook executing the plugin.
   * @throws {Error} If resource budget is exhausted.
   */
  preExecuteAudit(pluginName: string, hook: PluginHook): void {
    if (this.timeSpentMs >= this.policy.maxSequenceBudgetMs) {
      const errorMsg = `Resource Gating: Plugin "${pluginName}" blocked from running on "${hook}". Cumulative execution time (${this.timeSpentMs}ms) exceeds the governor budget limit of ${this.policy.maxSequenceBudgetMs}ms.`;
      this.emitViolation(pluginName, 'resource_exhaustion', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Post-execution governor audit. Tracks execution time and handles deviations.
   *
   * @param result - The output plugin execution result.
   */
  postExecuteAudit(result: PluginExecutionResult): void {
    this.timeSpentMs += result.durationMs;

    // 1. Check if execution time exceeds the single plugin time limit
    if (result.durationMs > this.policy.maxExecutionTimeMs) {
      const warnMsg = `Performance Warning: Plugin "${result.pluginName}" took ${result.durationMs}ms, exceeding the governor limit of ${this.policy.maxExecutionTimeMs}ms.`;
      this.emitViolation(result.pluginName, 'performance_limit', warnMsg);
    }

    // 2. Alert on failures for fail-closed plugins
    const instance = pluginRegistry.get(result.pluginName);
    if (instance && instance.definition.failureMode === 'fail-closed' && !result.passed) {
      const warnMsg = `Critical Safety Block: Fail-closed plugin "${result.pluginName}" failed to meet threshold. Score: ${result.compositeScore}. Gating pipeline.`;
      this.emitViolation(result.pluginName, 'critical_safety_block', warnMsg);
    }
  }

  /** Emits policy violation events to the event bus. */
  private emitViolation(pluginName: string, violationType: string, message: string): void {
    pluginEventBus.emit({
      type: 'plugin:execution:error',
      pluginName,
      timestamp: new Date().toISOString(),
      data: {
        governorViolation: true,
        violationType,
        message,
      },
    }).catch(() => {
      // Swallowed to prevent event bus failure loop
    });
  }
}

/** Shared singleton instance of the System Governor. */
export const systemGovernor: SystemGovernor = new SystemGovernor();
