# Agent Layer Architecture

This document outlines the design, execution loop, and governance of the autonomous **Agent Layer** within the SEO/AEO Platform.

---

## 1. Component Topology

The Agent Layer sits above the Plugins and Skills layers, acting as an orchestrator that monitors logs, patches code/content, and handles rollbacks.

```
                  ┌────────────────────────┐
                  │      GitHub Repo       │ <── (Code & Configs)
                  └───────────┬────────────┘
                              │ (Webhooks / Commits)
                              ▼
                  ┌────────────────────────┐
                  │    System Governor     │
                  └───────────┬────────────┘
                              │ (Allows / Blocks)
                              ▼
                  ┌────────────────────────┐
                  │     Agent Manager      │
                  └──────┬────┬────┬───────┘
                         │    │    │
         ┌───────────────┘    │    └───────────────┐
         ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│   Content      │   │    Deploy &    │   │     Trend      │
│  Re-Writer     │   │    Recovery    │   │   Discovery    │
│    Agent       │   │     Agent      │   │     Agent      │
└───────┬────────┘   └────────┬───────┘   └────────┬───────┘
        │                     │                    │
        └──────────────┐      │      ┌─────────────┘
                       ▼      ▼      ▼
                  ┌────────────────────────┐
                  │     Skills Registry    │ <── (flesch, n-gram, rss)
                  └────────────────────────┘
```

---

## 2. Agent Operational Specs

### 2.1. Deploy & Recovery Agent (Rollback Controller)
* **Goal:** Protect production sites from broken deployments.
* **Trigger:** Intercepts `publish_gate_red` (score < 700) events from the System Governor.
* **Flow:**
  1. Identifies failed branch commit hash.
  2. Queries git local tree for the last stable version tagged `plugin-layer-v1`.
  3. Commands the repository to force rollback: `git checkout <hash> --force`.
  4. Posts critical alerts to EventBus and logs error metrics.

### 2.2. Content Re-Writer Agent (Self-Healing Loop)
* **Goal:** Automatically fix low-quality or SEO-deficient content page drafts.
* **Trigger:** Intercepts `publish_gate_yellow` (score 700-799) warning states.
* **Flow:**
  1. Scans build logs to isolate failing checks (e.g., Flesch readability < 60, duplicate Jaccard ratio > 0.15).
  2. Synthesizes repair prompts containing the original text, failing score metrics, and correction goals.
  3. Executes LLM rewriting cycle.
  4. Patches markdown front-matter/body content files.
  5. Re-runs gating checks. If score improves to >= 800, approves staging promotion.

### 2.3. Trend Discovery Agent (Scraper & Planner)
* **Goal:** Schedule keyword monitoring and map algorithm updates.
* **Trigger:** Cron scheduler triggers (Daily at 2:00 AM).
* **Flow:**
  1. Scrapes Google algorithm update feeds using `rss-feed-monitor` skill.
  2. Logs updates in database history.
  3. If vulnerability metrics are high, notifies the Content Re-Writer agent to update author metadata.

---

## 3. Safety Guardrails & Limits

To prevent runaway agent loops, the System Governor enforces strict limits:
1. **Recursion Limit:** The Content Re-Writer is restricted to a maximum of **3 consecutive rewriting iterations** on a single draft file. If the score fails to meet the threshold, execution is aborted, and a warning is logged.
2. **Access Control Whitelists:** Agents cannot invoke unsanctioned CLI commands or databases.
3. **Sequence timeout budget:** All agent tasks are bound to the maximum sequence timeout budget of 90 seconds.
