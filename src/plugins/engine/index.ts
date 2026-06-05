/**
 * @file Barrel export for the plugin engine module.
 * @module plugins/engine
 *
 * Re-exports all public types, classes, and singleton instances so that
 * consumers can import everything from a single path:
 *
 * ```ts
 * import { pluginRegistry, pluginExecutor, type PluginDefinition } from './plugins/engine/index.js';
 * ```
 */

// -- Types ------------------------------------------------------------------
export type {
  CheckContext,
  CheckResult,
  CheckSeverity,
  FailureMode,
  PageMetadata,
  PluginCheck,
  PluginDefinition,
  PluginEvent,
  PluginEventHandler,
  PluginEventType,
  PluginExecutionResult,
  PluginHook,
  PluginInstance,
  PluginStatus,
  RegistryState,
  SiteConfig,
} from './types.js';

// -- Event Bus --------------------------------------------------------------
export { PluginEventBus, pluginEventBus } from './events.js';

// -- Registry ---------------------------------------------------------------
export { PluginRegistry, pluginRegistry } from './registry.js';

// -- Executor ---------------------------------------------------------------
export { PluginExecutor, pluginExecutor } from './executor.js';

// -- Lifecycle Manager ------------------------------------------------------
export {
  PluginLifecycleManager,
  pluginLifecycleManager,
} from './lifecycle.js';
export type { PluginHealthReport } from './lifecycle.js';

// -- System Governor --------------------------------------------------------
export {
  SystemGovernor,
  systemGovernor,
} from './governor.js';
export type { GovernorPolicy } from './governor.js';

