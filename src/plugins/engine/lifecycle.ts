/**
 * @file Plugin lifecycle manager — init, shutdown, health, convenience helpers.
 * @module plugins/engine/lifecycle
 *
 * Provides a high-level orchestration layer over the registry, executor,
 * and event bus. Consumers interact with the lifecycle manager to bootstrap
 * the plugin system, register + activate plugins in a single call, query
 * system health, and perform graceful shutdown.
 */

import type {
  PluginDefinition,
  PluginInstance,
} from './types.js';
import { pluginEventBus } from './events.js';
import { pluginRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Health report type
// ---------------------------------------------------------------------------

/**
 * Describes the aggregate health of the plugin subsystem.
 */
export interface PluginHealthReport {
  /** Total number of registered plugins (all statuses). */
  totalPlugins: number;

  /** Number of plugins currently in the `active` state. */
  activePlugins: number;

  /** Sum of checks across all registered plugins. */
  totalChecks: number;

  /**
   * Overall system status:
   * - `healthy`  – all plugins are active or disabled by intent
   * - `degraded` – at least one plugin is in `error` state
   * - `error`    – the system has not been initialized
   */
  status: 'healthy' | 'degraded' | 'error';
}

// ---------------------------------------------------------------------------
// PluginLifecycleManager
// ---------------------------------------------------------------------------

/**
 * Manages the overall lifecycle of the plugin engine subsystem.
 *
 * @remarks
 * This is the recommended entry point for bootstrapping and tearing down
 * the plugin infrastructure. It coordinates the registry, executor, and
 * event bus so that consumers do not need to manage those individually.
 *
 * @example
 * ```ts
 * await pluginLifecycleManager.initialize();
 * await pluginLifecycleManager.registerAndActivate(myPluginDef);
 * const health = pluginLifecycleManager.getHealthReport();
 * await pluginLifecycleManager.shutdown();
 * ```
 */
export class PluginLifecycleManager {
  /** Whether {@link initialize} has been called successfully. */
  private initialized: boolean;

  /** Whether {@link shutdown} has been called. */
  private shutdownCalled: boolean;

  /**
   * Creates a new {@link PluginLifecycleManager} instance.
   */
  constructor() {
    this.initialized = false;
    this.shutdownCalled = false;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Bootstrap the plugin engine subsystem.
   *
   * This method is idempotent — calling it multiple times after the first
   * successful invocation is a safe no-op.
   *
   * Steps performed:
   * 1. Mark the registry as initialized.
   * 2. Persist initial state to the SQLite audit table (if available).
   * 3. Create memory-graph entities for the plugin subsystem (if available).
   *
   * @throws {Error} If a critical initialisation step fails.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // -- SQLite audit table -----------------------------------------------
      await this.ensureAuditTable();

      // -- Memory-graph entity ----------------------------------------------
      await this.ensureMemoryGraphEntities();

      // -- Mark registry ready ----------------------------------------------
      pluginRegistry.markInitialized();
      this.initialized = true;
      this.shutdownCalled = false;

      console.info('[PluginLifecycleManager] Plugin engine initialized.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[PluginLifecycleManager] Initialization failed: ${message}`,
      );
      throw new Error(`Plugin engine initialization failed: ${message}`);
    }
  }

  // -----------------------------------------------------------------------
  // Convenience: register + activate
  // -----------------------------------------------------------------------

  /**
   * Register a plugin definition and immediately activate it.
   *
   * This is a convenience wrapper around
   * `pluginRegistry.register` + `pluginRegistry.activate`.
   *
   * @param definition - The plugin definition to register and activate.
   * @returns The newly created and activated {@link PluginInstance}.
   * @throws {Error} If the system has not been initialized.
   * @throws {Error} If registration or activation fails.
   */
  async registerAndActivate(
    definition: PluginDefinition,
  ): Promise<PluginInstance> {
    this.ensureInitialized();

    const instance = pluginRegistry.register(definition);

    try {
      pluginRegistry.activate(definition.name);
    } catch (activationError: unknown) {
      // If activation fails after successful registration we should
      // leave the plugin in `registered` state — the caller can retry.
      const message =
        activationError instanceof Error
          ? activationError.message
          : String(activationError);
      console.error(
        `[PluginLifecycleManager] Activation of "${definition.name}" failed: ${message}`,
      );
      throw new Error(
        `Plugin "${definition.name}" was registered but activation failed: ${message}`,
      );
    }

    // Persist the registration event to the audit log.
    await this.auditLog('register_and_activate', definition.name, {
      version: definition.version,
      hooks: definition.hooks,
      checkCount: definition.checks.length,
    });

    return pluginRegistry.get(definition.name) as PluginInstance;
  }

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  /**
   * Gracefully shut down the plugin engine subsystem.
   *
   * Steps performed:
   * 1. Deactivate all active plugins.
   * 2. Remove all event bus listeners.
   * 3. Write a shutdown audit entry.
   *
   * This method is idempotent.
   */
  async shutdown(): Promise<void> {
    if (this.shutdownCalled) {
      return;
    }
    this.shutdownCalled = true;

    // Deactivate every active plugin.
    const allPlugins = pluginRegistry.getAll();
    for (const instance of allPlugins) {
      if (instance.status === 'active') {
        try {
          pluginRegistry.deactivate(instance.definition.name);
        } catch {
          // Best-effort — we are shutting down.
        }
      }
    }

    // Clear event bus.
    pluginEventBus.removeAllListeners();

    // Audit.
    await this.auditLog('shutdown', '*', {
      pluginCount: allPlugins.length,
    });

    this.initialized = false;

    console.info('[PluginLifecycleManager] Plugin engine shut down.');
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  /**
   * Produce a health report for the plugin subsystem.
   *
   * @returns A {@link PluginHealthReport} summarising the current state.
   */
  getHealthReport(): PluginHealthReport {
    const allPlugins = pluginRegistry.getAll();

    let activeCount = 0;
    let errorCount = 0;
    let totalChecks = 0;

    for (const instance of allPlugins) {
      totalChecks += instance.definition.checks.length;
      if (instance.status === 'active') {
        activeCount += 1;
      }
      if (instance.status === 'error') {
        errorCount += 1;
      }
    }

    let status: 'healthy' | 'degraded' | 'error';
    if (!this.initialized) {
      status = 'error';
    } else if (errorCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      totalPlugins: allPlugins.length,
      activePlugins: activeCount,
      totalChecks,
      status,
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Guard that throws if the system has not been initialized.
   *
   * @throws {Error} If {@link initialize} has not been called.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'Plugin engine has not been initialized. Call initialize() first.',
      );
    }
  }

  /**
   * Create the SQLite audit table if it does not already exist.
   *
   * Failures are logged but do not block initialisation — the audit log
   * is a best-effort persistence layer.
   */
  private async ensureAuditTable(): Promise<void> {
    try {
      const { callMcpTool } = await this.getMcpHelpers();
      if (!callMcpTool) {
        return;
      }

      await callMcpTool('sqlite', 'create_table', {
        path: '/root/.gemini/antigravity-cli/data/plugins.db',
        table_name: 'plugin_audit_log',
        columns: [
          'id INTEGER PRIMARY KEY AUTOINCREMENT',
          'action TEXT NOT NULL',
          'plugin_name TEXT NOT NULL',
          'data TEXT',
          'created_at TEXT NOT NULL DEFAULT (datetime(\'now\'))',
        ].join(', '),
      });
    } catch {
      // SQLite MCP may not be available — degrade gracefully.
      console.warn(
        '[PluginLifecycleManager] SQLite audit table creation skipped (MCP unavailable).',
      );
    }
  }

  /**
   * Create memory-graph entities for the plugin subsystem.
   *
   * Failures are logged but do not block initialisation.
   */
  private async ensureMemoryGraphEntities(): Promise<void> {
    try {
      const { callMcpTool } = await this.getMcpHelpers();
      if (!callMcpTool) {
        return;
      }

      await callMcpTool('memory', 'create_entities', {
        entities: [
          {
            name: 'PluginEngine',
            entityType: 'System',
            observations: [
              'Core plugin execution engine for SEO/AEO platform',
              `Initialized at ${new Date().toISOString()}`,
            ],
          },
        ],
      });
    } catch {
      // Memory MCP may not be available — degrade gracefully.
      console.warn(
        '[PluginLifecycleManager] Memory-graph entity creation skipped (MCP unavailable).',
      );
    }
  }

  /**
   * Write an entry to the SQLite audit log.
   *
   * This is best-effort; failures are logged but never thrown.
   *
   * @param action     - The action name (e.g. `register_and_activate`).
   * @param pluginName - The plugin name (or `*` for system-wide actions).
   * @param data       - Arbitrary JSON-serialisable data.
   */
  private async auditLog(
    action: string,
    pluginName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { callMcpTool } = await this.getMcpHelpers();
      if (!callMcpTool) {
        return;
      }

      await callMcpTool('sqlite', 'write_query', {
        path: '/root/.gemini/antigravity-cli/data/plugins.db',
        query: `INSERT INTO plugin_audit_log (action, plugin_name, data, created_at) VALUES ('${action}', '${pluginName}', '${JSON.stringify(data).replace(/'/g, "''")}', datetime('now'))`,
      });
    } catch {
      // Best-effort.
    }
  }

  /**
   * Lazily attempt to import MCP call helpers.
   *
   * Returns a no-op helper if MCP infrastructure is not available at
   * runtime, which allows the lifecycle manager to function in
   * environments without MCP servers (unit tests, standalone CLI).
   *
   * @returns An object with a nullable `callMcpTool` function.
   */
  private async getMcpHelpers(): Promise<{
    callMcpTool:
      | ((
          server: string,
          tool: string,
          args: Record<string, unknown>,
        ) => Promise<unknown>)
      | null;
  }> {
    // In the current architecture MCP tools are invoked by the agent
    // runtime, not by application code. The lifecycle manager therefore
    // returns null so that all MCP-dependent paths degrade gracefully.
    return { callMcpTool: null };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Shared singleton instance of the plugin lifecycle manager.
 */
export const pluginLifecycleManager: PluginLifecycleManager =
  new PluginLifecycleManager();
