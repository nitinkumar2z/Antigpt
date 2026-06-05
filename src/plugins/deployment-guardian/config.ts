/**
 * @module deployment-guardian/config
 * @description Configuration constants for the Deployment Guardian plugin.
 *
 * All check weights, thresholds, and tuning parameters are centralised here
 * so they can be adjusted without modifying check logic.
 */

/**
 * Shape of the Deployment Guardian configuration object.
 *
 * - `threshold` — minimum weighted score (0–100) required for the plugin to pass.
 * - `failureMode` — `'fail-closed'` means a failure blocks the deployment pipeline.
 * - `checks` — per-check relative weights (must sum to 100).
 */
export interface DeploymentGuardianConfig {
  readonly threshold: number;
  readonly failureMode: 'fail-open' | 'fail-closed';
  readonly checks: {
    readonly githubValidation: { readonly weight: number };
    readonly cloudflareValidation: { readonly weight: number };
    readonly rollbackValidation: { readonly weight: number };
  };
}

/**
 * Concrete configuration instance for the Deployment Guardian plugin.
 *
 * | Check                  | Weight | Severity |
 * |------------------------|--------|----------|
 * | github-validation      | 35     | critical |
 * | cloudflare-validation  | 35     | critical |
 * | rollback-validation    | 30     | warning  |
 */
export const deploymentGuardianConfig: DeploymentGuardianConfig = {
  threshold: 80,
  failureMode: 'fail-closed' as const,
  checks: {
    githubValidation: { weight: 35 },
    cloudflareValidation: { weight: 35 },
    rollbackValidation: { weight: 30 },
  },
};
