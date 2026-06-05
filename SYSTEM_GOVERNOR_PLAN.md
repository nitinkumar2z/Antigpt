# System Governor Plan — Architectural Specification

This document details the architecture and implementation roadmap for the **System Governor** layer of the SEO/AEO platform. The governor acts as the core policy enforcer, regulating access to MCP tools, tracking execution resources, scheduling periodic audits, and executing publishing gates.

---

## 1. System Governor Architecture

The System Governor sits as an interception layer between the platform pipeline, the plugin executor, and the MCP adapters. It enforces security, compliance, resource budgets, and publishing rules.

```
┌────────────────────────────────────────────────────────┐
│                   AstroJS Content Build                │
└───────────────────────────┬────────────────────────────┘
                            │ (pre-publish / post-build)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    System Governor                     │
│  - Security Policies      - Resource Time Budget       │
│  - Publish Rules Gating   - Audit Schedules Routing    │
└───────────┬───────────────────────────────┬────────────┘
            │ (Allow / Deny)                │ (Execute)
            ▼                               ▼
┌──────────────────────┐        ┌────────────────────────┐
│ MCP Access Shield    │        │ Plugin / Skill Engine  │
│  - github, cloudflare│        │  - Run 9 Plugins       │
│  - postgres, sqlite  │        │  - Run 15 Skills       │
└──────────────────────┘        └────────────────────────┘
```

---

## 2. Security & MCP Access Control Policies

To prevent untrusted code, external agent prompts, or rogue checks from modifying source codes or executing arbitrary cloud actions, the governor limits MCP tools access via strict whitelist rules:

| MCP Server | Restricting Rationale | Authorized Plugins | Authorized Skills |
| :--- | :--- | :--- | :--- |
| **`github`** | Protects repo integrity, prevents unauthorized tag creations or code edits | `deployment-guardian` | `integration:github-status` |
| **`cloudflare`** | Safeguards serverless routing, domain bindings, and edge deployments | `deployment-guardian` | `integration:cloudflare-check` |
| **`postgres`** | Restricts primary application/revenue data tables from manipulation | `tool-planner`, `weekly-seo-engine` | `db:relational-planner`, `db:performance-index` |
| **`sqlite`** | Protects the local audit log and configuration settings from corruption | `weekly-seo-engine`, `google-update-engine` | `db:relational-planner`, `db:performance-index` |
| **`playwright`** | Caps browser instances to prevent memory leaks and process blocks | `qa-automation`, `weekly-seo-engine` | `integration:playwright-render`, `integration:accessibility-axe` |

*Policy Enforcement Rule:* If any check requests a restricted MCP dependency not declared in its whitelisted namespace, the registry blocks registration with a `SecurityViolationError` and emits an alert to the event bus.

---

## 3. Resource Gating & Time Budgets

To protect serverless edges (e.g. Cloudflare Workers CPU bounds) and build times from runaway async processes, the governor enforces strict execution limits:

1.  **Per-Check Isolation Timeout:** Default `10,000ms`. Any check exceeding this limit is terminated, receives a score of `0`, and records a timeout fault.
2.  **Per-Plugin Ceiling:** Default `30,000ms`. A single plugin (combining multiple checks) cannot run longer than 30 seconds.
3.  **Cumulative Sequence Budget:** Default `90,000ms`. The total duration for a full Hook pipeline run (e.g. executing all `pre-publish` plugins together) is budgeted at 90 seconds. If the budget is exhausted, further execution is halted and the build is aborted.

---

## 4. Universal Publish Gating Rules

At the completion of the `pre-publish` sequence, the governor aggregates the final composite score scaled to the `0-1000` Universal Scoring Framework and applies publishing rules:

```
                  Universal Composite Score (0-1000)
    ┌───────────────────────────┬───────────────────────────┐
    │                           │                           │
  < 700                       700 - 799                    >= 800
    ▼                           ▼                           ▼
[ REJECT (Red) ]         [ NEEDS FIX (Yellow) ]      [ PUBLISH (Green) ]
- Hard build failure.    - Warning logged.           - Success build state.
- Block deployments.     - Allow staging deploy.     - Sync code to production.
- Alert Recovery Agent.  - Tag for Re-Writer Agent.  - Tag Git release version.
```

### Recovery & Auto-Remediation Loops
*   **Reject Loop (< 700):** Triggers an automatic alert to the **Deploy & Recovery Agent** to roll back the current Git ref to the last stable tagged release (e.g. `plugin-layer-v1`).
*   **Needs Fix Loop (700-799):** Dispatches the failed check details to the **Content Re-Writer Agent**, initiating an automated prompt loop to patch the content files and re-submit the build.

---

## 5. Audit Scheduling Architecture

The Governor Schedules Engine directs automated runs under two distinct execution profiles:

### 5.1. Nightly System Audit
*   **Trigger:** Cron `0 2 * * *` (Daily at 2:00 AM local time).
*   **Target Scope:** Light, automated verification.
*   **Actions:**
    1.  Execute `google-update-engine` to pull RSS algorithm changes and analyze vulnerability vectors.
    2.  Execute `seo-auditor` and `aeo-auditor` on a randomized 10% sample of published content.
    3.  Audit Playwright rendering compatibility on the homepage.
    4.  Generate `/reports/daily-system-report.md`.

### 5.2. Weekly Comprehensive Audit
*   **Trigger:** Cron `0 3 * * 0` (Sundays at 3:00 AM local time).
*   **Target Scope:** Deep system, dependency, and revenue verification.
*   **Actions:**
    1.  Execute `weekly-seo-engine` for a full database schema index audit and canonical verification.
    2.  Trigger `qa-automation` to perform full WCAG accessibility checks on all active URLs.
    3.  Verify Cloudflare deploy sizes and Environment bindings configuration.
    4.  Query PostgreSQL for AdSense CTR anomalies and calculate revenue scores.
    5.  Compile and write all detailed audit reports.
