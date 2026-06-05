/**
 * @file Plugin execution engine — runs checks, computes scores, emits events.
 * @module plugins/engine/executor
 *
 * The executor is the runtime workhorse of the plugin system. It retrieves
 * plugin instances from the registry, executes their checks with per-check
 * timeout isolation, computes weighted composite scores, and emits
 * granular events through the shared event bus.
 */

import { randomUUID } from 'node:crypto';

import type {
  CheckContext,
  CheckResult,
  PluginCheck,
  PluginExecutionResult,
  PluginHook,
  PluginInstance,
} from './types.js';
import { pluginEventBus } from './events.js';
import { pluginRegistry } from './registry.js';
import { systemGovernor } from './governor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default per-check timeout in milliseconds.
 * Can be overridden via {@link PluginExecutor.setCheckTimeout}.
 */
const DEFAULT_CHECK_TIMEOUT_MS = 10_000;

/**
 * Execute a single check with a timeout guard.
 *
 * If the check's `execute` method does not resolve within `timeoutMs`,
 * the returned promise rejects with a timeout error. The underlying
 * check execution cannot be forcibly cancelled (JS limitation) but the
 * caller treats the result as failed.
 *
 * @param check     - The check definition to execute.
 * @param context   - The page / site context.
 * @param timeoutMs - Maximum allowed execution time.
 * @returns The check result or a rejection.
 */
function executeCheckWithTimeout(
  check: PluginCheck,
  context: CheckContext,
  timeoutMs: number,
): Promise<CheckResult> {
  return new Promise<CheckResult>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Check "${check.name}" timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    // Prevent the timer from keeping the process alive if the check
    // finishes quickly (important for CLI tools and tests).
    if (typeof timer === 'object' && 'unref' in timer) {
      (timer as NodeJS.Timeout).unref();
    }

    try {
      const result = check.execute(context);
      result
        .then((value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        })
        .catch((err: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    } catch (syncError: unknown) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(syncError);
      }
    }
  });
}

/**
 * Build a failed {@link CheckResult} for a check that threw or timed out.
 *
 * @param check   - The check that failed.
 * @param message - Human-readable error description.
 * @returns A zero-score, failed check result.
 */
function buildFailedCheckResult(check: PluginCheck, message: string): CheckResult {
  return {
    checkName: check.name,
    score: 0,
    passed: false,
    severity: check.severity,
    message,
    details: { error: true },
  };
}

// ---------------------------------------------------------------------------
// PluginExecutor
// ---------------------------------------------------------------------------

/**
 * Executes plugin checks, computes composite scores, and emits events.
 *
 * @remarks
 * - Each check runs in isolation: a failing check receives score 0 but
 *   does not abort the remaining checks.
 * - The composite score is a weighted average:
 *   `sum(score_i × weight_i) / sum(weight_i)`.
 * - The plugin passes when `compositeScore >= plugin.threshold`.
 * - Every meaningful step emits a {@link PluginEvent} through
 *   {@link pluginEventBus}.
 *
 * @example
 * ```ts
 * const result = await pluginExecutor.executePlugin(
 *   'seo-meta-checker',
 *   context,
 *   'pre-publish',
 * );
 * console.log(result.compositeScore);
 * ```
 */
export class PluginExecutor {
  /** Per-check timeout in milliseconds. */
  private checkTimeoutMs: number;

  /**
   * Creates a new {@link PluginExecutor} instance.
   *
   * @param checkTimeoutMs - Per-check execution timeout (default 10 000 ms).
   */
  constructor(checkTimeoutMs: number = DEFAULT_CHECK_TIMEOUT_MS) {
    this.checkTimeoutMs = checkTimeoutMs;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /**
   * Override the per-check execution timeout.
   *
   * @param ms - Timeout in milliseconds. Must be a positive integer.
   * @throws {Error} If `ms` is not a positive finite number.
   */
  setCheckTimeout(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new Error('Check timeout must be a positive finite number.');
    }
    this.checkTimeoutMs = ms;
  }

  /**
   * Returns the current per-check timeout in milliseconds.
   *
   * @returns The configured timeout value.
   */
  getCheckTimeout(): number {
    return this.checkTimeoutMs;
  }

  // -----------------------------------------------------------------------
  // Single-plugin execution
  // -----------------------------------------------------------------------

  /**
   * Execute all checks for a single named plugin.
   *
   * @param pluginName - Name of a registered, **active** plugin.
   * @param context    - The page / site context to evaluate.
   * @param hook       - The hook that triggered this execution.
   * @returns A structured {@link PluginExecutionResult}.
   * @throws {Error} If the plugin is not registered or not active.
   */
  async executePlugin(
    pluginName: string,
    context: CheckContext,
    hook: PluginHook,
  ): Promise<PluginExecutionResult> {
    // Run pre-execution governor audit
    systemGovernor.preExecuteAudit(pluginName, hook);

    const executionId = randomUUID();
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    // ---- Retrieve instance ------------------------------------------------
    const instance = pluginRegistry.get(pluginName);
    if (!instance) {
      throw new Error(`Plugin "${pluginName}" is not registered.`);
    }
    if (instance.status !== 'active') {
      throw new Error(
        `Plugin "${pluginName}" is not active (current status: "${instance.status}").`,
      );
    }

    const { definition } = instance;

    // ---- Emit start event -------------------------------------------------
    await pluginEventBus.emit({
      type: 'plugin:execution:start',
      pluginName,
      timestamp,
      data: { executionId, hook, pageUrl: context.url },
    });

    // ---- Execute checks ---------------------------------------------------
    const results: CheckResult[] = [];
    let checksPassedCount = 0;
    let checksFailedCount = 0;

    for (const check of definition.checks) {
      const checkStart = new Date().toISOString();

      await pluginEventBus.emit({
        type: 'check:start',
        pluginName,
        timestamp: checkStart,
        data: { executionId, checkName: check.name },
      });

      let result: CheckResult;

      try {
        result = await executeCheckWithTimeout(check, context, this.checkTimeoutMs);

        // Clamp score to [0, 100] defensively.
        result.score = Math.max(0, Math.min(100, result.score));
        // Individual checks always score 0-100; scaling happens at composite level
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        result = buildFailedCheckResult(check, message);

        await pluginEventBus.emit({
          type: 'check:error',
          pluginName,
          timestamp: new Date().toISOString(),
          data: { executionId, checkName: check.name, error: message },
        });
      }

      results.push(result);

      if (result.passed) {
        checksPassedCount += 1;
      } else {
        checksFailedCount += 1;
      }

      await pluginEventBus.emit({
        type: 'check:complete',
        pluginName,
        timestamp: new Date().toISOString(),
        data: {
          executionId,
          checkName: check.name,
          score: result.score,
          passed: result.passed,
        },
      });
    }

    // ---- Compute composite score ------------------------------------------
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (let i = 0; i < definition.checks.length; i++) {
      const check = definition.checks[i];
      const result = results[i];
      totalWeightedScore += result.score * check.weight;
      totalWeight += check.weight;
    }

    const scoreScale = definition.scoreScale ?? 100;
    const rawComposite =
      totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    // Scale the 0-100 raw score to the plugin's score scale
    const compositeScore =
      Math.round((rawComposite * scoreScale / 100) * 100) / 100;

    const passed = compositeScore >= definition.threshold;

    // ---- Build result -----------------------------------------------------
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    const executionResult: PluginExecutionResult = {
      id: executionId,
      pluginName,
      hook,
      pageUrl: context.url,
      compositeScore,
      passed,
      checksRun: definition.checks.length,
      checksPassed: checksPassedCount,
      checksFailed: checksFailedCount,
      results,
      durationMs,
      timestamp,
    };

    // ---- Update instance state --------------------------------------------
    instance.lastExecutedAt = new Date().toISOString();
    instance.executionCount += 1;

    // ---- Emit completion event --------------------------------------------
    await pluginEventBus.emit({
      type: 'plugin:execution:complete',
      pluginName,
      timestamp: new Date().toISOString(),
      data: {
        executionId,
        compositeScore,
        passed,
        durationMs,
        checksRun: definition.checks.length,
        checksPassed: checksPassedCount,
        checksFailed: checksFailedCount,
      },
    });

    // Run post-execution governor audit
    systemGovernor.postExecuteAudit(executionResult);

    return executionResult;
  }

  // -----------------------------------------------------------------------
  // Hook-level execution
  // -----------------------------------------------------------------------

  /**
   * Execute all **active** plugins bound to a specific hook.
   *
   * Plugins are executed sequentially in registration order.
   *
   * @param hook    - The lifecycle hook to execute.
   * @param context - The page / site context to evaluate.
   * @returns An array of {@link PluginExecutionResult}, one per plugin.
   */
  async executeHook(
    hook: PluginHook,
    context: CheckContext,
  ): Promise<PluginExecutionResult[]> {
    // Reset governor execution budget for this sequence
    systemGovernor.resetBudget();

    const instances = pluginRegistry.getByHook(hook);
    const results: PluginExecutionResult[] = [];

    for (const instance of instances) {
      try {
        const result = await this.executePlugin(
          instance.definition.name,
          context,
          hook,
        );
        results.push(result);
      } catch (err: unknown) {
        // If executePlugin throws (e.g. plugin deactivated mid-run),
        // record a synthetic error result so the caller sees every plugin.
        const message = err instanceof Error ? err.message : String(err);
        const errorResult: PluginExecutionResult = {
          id: randomUUID(),
          pluginName: instance.definition.name,
          hook,
          pageUrl: context.url,
          compositeScore: 0,
          passed: false,
          checksRun: 0,
          checksPassed: 0,
          checksFailed: 0,
          results: [],
          durationMs: 0,
          timestamp: new Date().toISOString(),
          error: message,
        };
        results.push(errorResult);

        await pluginEventBus.emit({
          type: 'plugin:execution:error',
          pluginName: instance.definition.name,
          timestamp: new Date().toISOString(),
          data: { hook, error: message },
        });

        // Mark the plugin as errored in the registry.
        pluginRegistry.markError(instance.definition.name, message);
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Full execution
  // -----------------------------------------------------------------------

  /**
   * Execute **all active** plugins regardless of hook binding.
   *
   * Each plugin is executed once (even if it is bound to multiple hooks).
   * The `hook` field on each result is set to the plugin's first declared hook.
   *
   * @param context - The page / site context to evaluate.
   * @returns A `Map` of plugin name → {@link PluginExecutionResult}.
   */
  async executeAll(
    context: CheckContext,
  ): Promise<Map<string, PluginExecutionResult>> {
    // Reset governor execution budget for this sequence
    systemGovernor.resetBudget();

    const allInstances = pluginRegistry.getAll();
    const resultMap = new Map<string, PluginExecutionResult>();

    for (const instance of allInstances) {
      if (instance.status !== 'active') {
        continue;
      }

      const primaryHook = instance.definition.hooks[0];

      try {
        const result = await this.executePlugin(
          instance.definition.name,
          context,
          primaryHook,
        );
        resultMap.set(instance.definition.name, result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const errorResult: PluginExecutionResult = {
          id: randomUUID(),
          pluginName: instance.definition.name,
          hook: primaryHook,
          pageUrl: context.url,
          compositeScore: 0,
          passed: false,
          checksRun: 0,
          checksPassed: 0,
          checksFailed: 0,
          results: [],
          durationMs: 0,
          timestamp: new Date().toISOString(),
          error: message,
        };
        resultMap.set(instance.definition.name, errorResult);

        await pluginEventBus.emit({
          type: 'plugin:execution:error',
          pluginName: instance.definition.name,
          timestamp: new Date().toISOString(),
          data: { error: message },
        });

        pluginRegistry.markError(instance.definition.name, message);
      }
    }

    return resultMap;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Shared singleton instance of the plugin executor.
 */
export const pluginExecutor: PluginExecutor = new PluginExecutor();
