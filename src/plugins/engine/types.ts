/**
 * @file Core type definitions for the plugin engine.
 * @module plugins/engine/types
 *
 * Defines all interfaces, type aliases, and contracts used throughout
 * the autonomous SEO/AEO plugin framework. Every plugin, check, event,
 * and execution result conforms to these types.
 */

// ---------------------------------------------------------------------------
// Scalar / Union Types
// ---------------------------------------------------------------------------

/**
 * Lifecycle hooks a plugin can bind to.
 *
 * - `pre-publish`  – runs before content is published
 * - `post-build`   – runs after a static build completes
 * - `on-schedule`  – runs on a recurring schedule (cron-driven)
 */
export type PluginHook = 'pre-publish' | 'post-build' | 'on-schedule';

/**
 * Severity levels for individual check results.
 *
 * - `critical` – must pass; failure blocks publishing in fail-closed mode
 * - `warning`  – should pass; non-blocking but flagged
 * - `info`     – informational only; never blocks
 */
export type CheckSeverity = 'critical' | 'warning' | 'info';

/**
 * Runtime status of a plugin instance within the registry.
 *
 * - `registered` – definition stored but not yet active
 * - `active`     – eligible for execution
 * - `disabled`   – manually or programmatically disabled
 * - `error`      – entered an error state during execution
 */
export type PluginStatus = 'registered' | 'active' | 'disabled' | 'error';

/**
 * Determines behaviour when a plugin's composite score falls below its
 * threshold.
 *
 * - `fail-open`   – log the failure but allow the pipeline to continue
 * - `fail-closed` – treat the failure as a hard block
 */
export type FailureMode = 'fail-open' | 'fail-closed';

// ---------------------------------------------------------------------------
// Check Interfaces
// ---------------------------------------------------------------------------

/**
 * The result of a single check execution.
 */
export interface CheckResult {
  /** Machine-readable name identifying this check. */
  checkName: string;

  /** Numeric score between 0 (worst) and 100 (best). */
  score: number;

  /** Whether the check is considered passing. */
  passed: boolean;

  /** Severity classification of this check. */
  severity: CheckSeverity;

  /** Human-readable summary of the result. */
  message: string;

  /** Optional structured details for tooling / dashboards. */
  details?: Record<string, unknown>;

  /** Optional actionable suggestion for fixing a failing check. */
  fixSuggestion?: string;
}

/**
 * Definition of a single executable check within a plugin.
 */
export interface PluginCheck {
  /** Unique name within the owning plugin. */
  name: string;

  /** Human-readable description of what this check validates. */
  description: string;

  /** Severity classification. */
  severity: CheckSeverity;

  /** Positive weighting factor used when computing the composite score. */
  weight: number;

  /**
   * Executes the check against the supplied context.
   *
   * @param context - The page / site context to evaluate.
   * @returns A promise resolving to the structured check result.
   */
  execute: (context: CheckContext) => Promise<CheckResult>;
}

// ---------------------------------------------------------------------------
// Context Interfaces
// ---------------------------------------------------------------------------

/**
 * Context object passed to every check at execution time.
 */
export interface CheckContext {
  /** Fully-qualified URL of the page being checked. */
  url: string;

  /** Rendered HTML of the page. */
  html: string;

  /** Raw source content (e.g. Markdown) before rendering. */
  rawContent: string;

  /** Structured metadata about the page. */
  metadata: PageMetadata;

  /** Global site configuration. */
  siteConfig: SiteConfig;
}

/**
 * Metadata describing a single page or piece of content.
 */
export interface PageMetadata {
  /** Page title (often the `<title>` or front-matter title). */
  title: string;

  /** Meta description. */
  description: string;

  /** URL slug (path segment). */
  slug: string;

  /** ISO 8601 publication timestamp. */
  publishedAt?: string;

  /** ISO 8601 last-updated timestamp. */
  updatedAt?: string;

  /** Author name or identifier. */
  author?: string;

  /** Taxonomy tags associated with the page. */
  tags?: string[];

  /** Total word count of the content body. */
  wordCount: number;

  /** Classification of the content type. */
  contentType: 'article' | 'page' | 'landing' | 'tool';
}

/**
 * Top-level site configuration used by checks that need site-wide context.
 */
export interface SiteConfig {
  /** Canonical base URL including protocol (e.g. `https://example.com`). */
  baseUrl: string;

  /** Human-readable site name. */
  siteName: string;

  /** BCP-47 default language code. */
  defaultLanguage: string;

  /** All BCP-47 language codes supported by the site. */
  supportedLanguages: string[];
}

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

/**
 * Structured result of executing all checks within a single plugin.
 */
export interface PluginExecutionResult {
  /** Unique execution identifier (UUID v4). */
  id: string;

  /** Name of the plugin that was executed. */
  pluginName: string;

  /** The hook that triggered this execution. */
  hook: PluginHook;

  /** URL of the page that was evaluated. */
  pageUrl: string;

  /** Weighted composite score across all checks (0–100). */
  compositeScore: number;

  /** Whether the composite score met or exceeded the plugin threshold. */
  passed: boolean;

  /** Total number of checks executed. */
  checksRun: number;

  /** Number of checks that passed. */
  checksPassed: number;

  /** Number of checks that failed. */
  checksFailed: number;

  /** Individual check results. */
  results: CheckResult[];

  /** Wall-clock duration of the entire plugin execution in milliseconds. */
  durationMs: number;

  /** ISO 8601 timestamp of when execution began. */
  timestamp: string;

  /** Error message if the plugin execution itself failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Plugin Definition & Instance
// ---------------------------------------------------------------------------

/**
 * Static definition of a plugin — everything needed to register it.
 */
export interface PluginDefinition {
  /** Unique kebab-case name (e.g. `seo-meta-checker`). */
  name: string;

  /** Semantic version string (e.g. `1.2.3`). */
  version: string;

  /** Human-readable description of the plugin's purpose. */
  description: string;

  /** Lifecycle hooks this plugin should run on. */
  hooks: PluginHook[];

  /** Behaviour when the composite score is below threshold. */
  failureMode: FailureMode;

  /** Minimum composite score (0–100) required for the plugin to pass. */
  threshold: number;

  /**
   * Maximum score value for this plugin's scoring scale.
   * Checks still return 0-100, but the composite score and threshold
   * are scaled to this range. Default is 100 (standard 0-100 scale).
   * Example: scoreScale=1000 means threshold=800 blocks below 80%.
   */
  scoreScale?: number;

  /**
   * MCP server dependencies this plugin requires.
   * Used for dependency validation during registration.
   */
  mcpDependencies?: string[];

  /** Ordered list of checks this plugin executes. */
  checks: PluginCheck[];
}

/**
 * Runtime representation of a plugin — its definition plus mutable state.
 */
export interface PluginInstance {
  /** Immutable definition the instance was created from. */
  definition: PluginDefinition;

  /** Current lifecycle status. */
  status: PluginStatus;

  /** ISO 8601 timestamp of when the plugin was registered. */
  registeredAt: string;

  /** ISO 8601 timestamp of when the plugin was last activated. */
  activatedAt?: string;

  /** ISO 8601 timestamp of the most recent execution. */
  lastExecutedAt?: string;

  /** Cumulative number of times the plugin has been executed. */
  executionCount: number;

  /** Cumulative number of errors encountered during execution. */
  errorCount: number;
}

// ---------------------------------------------------------------------------
// Event System
// ---------------------------------------------------------------------------

/**
 * Discriminated event types emitted by the plugin engine.
 */
export type PluginEventType =
  | 'plugin:registered'
  | 'plugin:activated'
  | 'plugin:deactivated'
  | 'plugin:execution:start'
  | 'plugin:execution:complete'
  | 'plugin:execution:error'
  | 'check:start'
  | 'check:complete'
  | 'check:error';

/**
 * Payload for a plugin engine event.
 */
export interface PluginEvent {
  /** Discriminated event type. */
  type: PluginEventType;

  /** Name of the plugin the event pertains to. */
  pluginName: string;

  /** ISO 8601 timestamp of when the event was created. */
  timestamp: string;

  /** Arbitrary structured data specific to the event type. */
  data: Record<string, unknown>;
}

/**
 * Callback signature for event subscribers.
 *
 * Handlers may be synchronous or asynchronous. Asynchronous handlers
 * are awaited but their rejections are caught to prevent cascading failures.
 */
export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Registry State
// ---------------------------------------------------------------------------

/**
 * Serialisable snapshot of the plugin registry's internal state.
 */
export interface RegistryState {
  /** Map of plugin name → runtime instance. */
  plugins: Map<string, PluginInstance>;

  /** Whether the registry has completed initialisation. */
  initialized: boolean;
}
