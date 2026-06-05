/**
 * @file Plugin registry — registration, validation, activation, and lookup.
 * @module plugins/engine/registry
 *
 * The registry is the single source of truth for which plugins are known
 * to the system and their current lifecycle state. It enforces strict
 * validation rules at registration time so that downstream subsystems
 * (executor, lifecycle manager) can assume invariants hold.
 */

import type {
  PluginDefinition,
  PluginHook,
  PluginInstance,
  PluginStatus,
  RegistryState,
} from './types.js';
import { pluginEventBus } from './events.js';
import { systemGovernor } from './governor.js';

// ---------------------------------------------------------------------------
// Validation helpers (module-private)
// ---------------------------------------------------------------------------

/** Kebab-case: one or more groups of lowercase alpha-numeric separated by hyphens. */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Simplified semver: MAJOR.MINOR.PATCH with optional pre-release / build metadata. */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?(?:\+[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/;

/** The exhaustive set of valid hook literals. */
const VALID_HOOKS: ReadonlySet<string> = new Set<string>([
  'pre-publish',
  'post-build',
  'on-schedule',
]);

/**
 * Validate a {@link PluginDefinition} and return an array of human-readable
 * error strings. An empty array means the definition is valid.
 *
 * @param def - The plugin definition to validate.
 * @returns An array of validation error messages (empty = valid).
 */
function validateDefinition(def: PluginDefinition): string[] {
  const errors: string[] = [];

  // -- name ------------------------------------------------------------------
  if (!def.name || typeof def.name !== 'string') {
    errors.push('Plugin name must be a non-empty string.');
  } else if (!KEBAB_CASE_RE.test(def.name)) {
    errors.push(
      `Plugin name "${def.name}" must be kebab-case (e.g. "my-plugin").`,
    );
  }

  // -- version ---------------------------------------------------------------
  if (!def.version || typeof def.version !== 'string') {
    errors.push('Plugin version must be a non-empty string.');
  } else if (!SEMVER_RE.test(def.version)) {
    errors.push(
      `Plugin version "${def.version}" must be a valid semver string (e.g. "1.0.0").`,
    );
  }

  // -- description -----------------------------------------------------------
  if (!def.description || typeof def.description !== 'string') {
    errors.push('Plugin description must be a non-empty string.');
  }

  // -- hooks -----------------------------------------------------------------
  if (!Array.isArray(def.hooks) || def.hooks.length === 0) {
    errors.push('Plugin must declare at least one hook.');
  } else {
    for (const hook of def.hooks) {
      if (!VALID_HOOKS.has(hook)) {
        errors.push(
          `Invalid hook "${String(hook)}". Valid hooks: ${[...VALID_HOOKS].join(', ')}.`,
        );
      }
    }
  }

  // -- failureMode -----------------------------------------------------------
  if (def.failureMode !== 'fail-open' && def.failureMode !== 'fail-closed') {
    errors.push(
      `Invalid failureMode "${String(def.failureMode)}". Must be "fail-open" or "fail-closed".`,
    );
  }

  // -- threshold -------------------------------------------------------------
  if (typeof def.threshold !== 'number' || !Number.isFinite(def.threshold)) {
    errors.push('Plugin threshold must be a finite number.');
  } else {
    const maxThreshold = def.scoreScale ?? 100;
    if (def.threshold < 0 || def.threshold > maxThreshold) {
      errors.push(`Plugin threshold must be between 0 and ${maxThreshold} (inclusive).`);
    }
  }

  // -- scoreScale -------------------------------------------------------------
  if (def.scoreScale !== undefined) {
    if (typeof def.scoreScale !== 'number' || !Number.isFinite(def.scoreScale) || def.scoreScale <= 0) {
      errors.push('Plugin scoreScale must be a positive finite number.');
    }
  }

  // -- checks ----------------------------------------------------------------
  if (!Array.isArray(def.checks) || def.checks.length === 0) {
    errors.push('Plugin must declare at least one check.');
  } else {
    const seenCheckNames = new Set<string>();

    for (let i = 0; i < def.checks.length; i++) {
      const check = def.checks[i];
      const prefix = `Check[${i}]`;

      if (!check.name || typeof check.name !== 'string') {
        errors.push(`${prefix}: name must be a non-empty string.`);
      } else if (seenCheckNames.has(check.name)) {
        errors.push(`${prefix}: duplicate check name "${check.name}".`);
      } else {
        seenCheckNames.add(check.name);
      }

      if (!check.description || typeof check.description !== 'string') {
        errors.push(`${prefix} ("${check.name ?? ''}"): description must be a non-empty string.`);
      }

      if (
        check.severity !== 'critical' &&
        check.severity !== 'warning' &&
        check.severity !== 'info'
      ) {
        errors.push(
          `${prefix} ("${check.name ?? ''}"): invalid severity "${String(check.severity)}".`,
        );
      }

      if (typeof check.weight !== 'number' || !Number.isFinite(check.weight) || check.weight <= 0) {
        errors.push(
          `${prefix} ("${check.name ?? ''}"): weight must be a positive finite number.`,
        );
      }

      if (typeof check.execute !== 'function') {
        errors.push(`${prefix} ("${check.name ?? ''}"): execute must be a function.`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// PluginRegistry
// ---------------------------------------------------------------------------

/**
 * Manages plugin registration, validation, activation, and lookup.
 *
 * @remarks
 * The registry enforces strict validation at registration time so that
 * the executor and lifecycle manager can rely on invariants without
 * re-checking. Lifecycle transitions emit events through the shared
 * {@link pluginEventBus}.
 *
 * @example
 * ```ts
 * const instance = pluginRegistry.register(myPluginDef);
 * pluginRegistry.activate(myPluginDef.name);
 * ```
 */
export class PluginRegistry {
  /** Internal map of plugin name → instance. */
  private readonly plugins: Map<string, PluginInstance>;

  /** Whether {@link initialize} has been called. */
  private initialized: boolean;

  /**
   * Creates a new {@link PluginRegistry}.
   */
  constructor() {
    this.plugins = new Map();
    this.initialized = false;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Mark the registry as initialized.
   *
   * @remarks
   * Called by the lifecycle manager after system-wide setup is complete.
   */
  markInitialized(): void {
    this.initialized = true;
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Validate and register a plugin definition.
   *
   * @param definition - The static plugin definition to register.
   * @returns The newly created {@link PluginInstance}.
   * @throws {Error} If the definition fails validation or a plugin with the
   *   same name is already registered.
   */
  register(definition: PluginDefinition): PluginInstance {
    // Run governor audit first
    systemGovernor.auditDefinition(definition);

    // Validate.
    const errors = validateDefinition(definition);
    if (errors.length > 0) {
      throw new Error(
        `Plugin "${definition.name ?? '(unnamed)'}" failed validation:\n  - ${errors.join('\n  - ')}`,
      );
    }

    // Duplicate guard.
    if (this.plugins.has(definition.name)) {
      throw new Error(
        `Plugin "${definition.name}" is already registered. ` +
          'Deregister it first or use a different name.',
      );
    }

    const now = new Date().toISOString();

    const instance: PluginInstance = {
      definition,
      status: 'registered' as PluginStatus,
      registeredAt: now,
      activatedAt: undefined,
      lastExecutedAt: undefined,
      executionCount: 0,
      errorCount: 0,
    };

    this.plugins.set(definition.name, instance);

    // Fire-and-forget event emission — we intentionally do not await here
    // so that synchronous callers are not forced into async control flow.
    void pluginEventBus.emit({
      type: 'plugin:registered',
      pluginName: definition.name,
      timestamp: now,
      data: { version: definition.version, hooks: definition.hooks },
    });

    return instance;
  }

  // -----------------------------------------------------------------------
  // Lookup
  // -----------------------------------------------------------------------

  /**
   * Retrieve a plugin instance by name.
   *
   * @param name - The plugin name.
   * @returns The {@link PluginInstance} or `undefined` if not found.
   */
  get(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  /**
   * Retrieve all registered plugin instances.
   *
   * @returns An array of all {@link PluginInstance} objects.
   */
  getAll(): PluginInstance[] {
    return [...this.plugins.values()];
  }

  /**
   * Retrieve all **active** plugins that are bound to a specific hook.
   *
   * @param hook - The lifecycle hook to filter on.
   * @returns An array of matching {@link PluginInstance} objects.
   */
  getByHook(hook: PluginHook): PluginInstance[] {
    const results: PluginInstance[] = [];
    for (const instance of this.plugins.values()) {
      if (
        instance.status === 'active' &&
        instance.definition.hooks.includes(hook)
      ) {
        results.push(instance);
      }
    }
    return results;
  }

  /**
   * Check whether a plugin with the given name is registered.
   *
   * @param name - The plugin name to check.
   * @returns `true` if registered, `false` otherwise.
   */
  isRegistered(name: string): boolean {
    return this.plugins.has(name);
  }

  // -----------------------------------------------------------------------
  // Lifecycle transitions
  // -----------------------------------------------------------------------

  /**
   * Transition a registered plugin to the `active` state.
   *
   * @param name - The plugin name to activate.
   * @throws {Error} If the plugin is not registered or is already active.
   */
  activate(name: string): void {
    const instance = this.plugins.get(name);
    if (!instance) {
      throw new Error(`Cannot activate unknown plugin "${name}".`);
    }
    if (instance.status === 'active') {
      throw new Error(`Plugin "${name}" is already active.`);
    }

    const now = new Date().toISOString();
    instance.status = 'active';
    instance.activatedAt = now;

    void pluginEventBus.emit({
      type: 'plugin:activated',
      pluginName: name,
      timestamp: now,
      data: { previousStatus: instance.status },
    });
  }

  /**
   * Transition a plugin to the `disabled` state.
   *
   * @param name - The plugin name to deactivate.
   * @throws {Error} If the plugin is not registered.
   */
  deactivate(name: string): void {
    const instance = this.plugins.get(name);
    if (!instance) {
      throw new Error(`Cannot deactivate unknown plugin "${name}".`);
    }

    const previousStatus = instance.status;
    const now = new Date().toISOString();
    instance.status = 'disabled';

    void pluginEventBus.emit({
      type: 'plugin:deactivated',
      pluginName: name,
      timestamp: now,
      data: { previousStatus },
    });
  }

  /**
   * Transition a plugin to the `error` state.
   *
   * @internal
   * @param name  - The plugin name.
   * @param error - A human-readable error description.
   */
  markError(name: string, error: string): void {
    const instance = this.plugins.get(name);
    if (!instance) {
      return; // Silently ignore — caller may have already deregistered.
    }
    instance.status = 'error';
    instance.errorCount += 1;

    console.error(`[PluginRegistry] Plugin "${name}" entered error state: ${error}`);
  }

  // -----------------------------------------------------------------------
  // State snapshot
  // -----------------------------------------------------------------------

  /**
   * Return a snapshot of the current registry state.
   *
   * @returns A {@link RegistryState} object with a **shallow copy** of the
   *   plugin map so that mutations to the returned map do not affect the
   *   registry.
   */
  getState(): RegistryState {
    return {
      plugins: new Map(this.plugins),
      initialized: this.initialized,
    };
  }

  /**
   * Remove all registered plugins. Primarily used in tests.
   */
  clear(): void {
    this.plugins.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Shared singleton instance of the plugin registry.
 */
export const pluginRegistry: PluginRegistry = new PluginRegistry();
