# Workflow Layer Architecture

This document details the scheduling, state machines, and recovery processes that drive the automated workflows in the SEO/AEO Platform.

---

## 1. Automated Execution Workflows

The platform coordinates asynchronous, self-healing workflows triggered by Git lifecycle events or cron schedules.

### 1.1. Self-Healing Publishing Workflow
This workflow triggers when content modifications fail the pre-publish gating score.

```
       [ Git Push / Draft ]
                │
                ▼
      ┌───────────────────┐
      │ pre-publish hook  │ <─── Run plugins (Quality, QA, Deploy)
      └─────────┬─────────┘
                │
         Score Evaluated?
         ┌──────┴──────┐
         ▼             ▼
     [ >= 800 ]     [ 700-799 ]
         │             │
         │             ▼
         │    ┌───────────────────┐
         │    │Content Re-Writer  │ <─── Scans logs & patches files
         │    └─────────┬─────────┘
         │              │
         │          Re-audit
         │       ┌──────┴──────┐
         │       ▼             ▼
         │   [ Pass ]       [ Fail ]
         │       │             │
         │       │             ▼
         │       │    ┌───────────────────┐
         │       │    │ Escalate (Manual) │
         │       │    └───────────────────┘
         ▼       ▼
   [ Publish Staging/Prod Release ]
```

### 1.2. Google Algorithm Update Adaptation Loop
This background schedule maps search changes and auto-remediates vulnerable content indexings.

```
      [ Daily Cron (2:00 AM) ]
                 │
                 ▼
       ┌───────────────────┐
       │ google-update     │ <─── Scrapes GoogleRSS updates
       └─────────┬─────────┘
                 │
          Update detected?
          ┌──────┴──────┐
          ▼             ▼
       [ NO ]        [ YES ]
          │             │
          ▼             ▼
       [ Idle ]   ┌───────────────────┐
                  │ Map vulnerability │ <─── Query memory graph
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │Content Re-Writer  │ <─── Updates author bios & E-E-A-T
                  └───────────────────┘
```

---

## 2. Integration and Interaction Schedules

Workflows run under specific scheduling profiles to preserve edge worker CPU budgets:

* **Trigger profiles:**
  * **Event-Driven:** `pre-publish` gating runs synchronously on code pushes.
  * **Build-Driven:** `post-build` audits run synchronously on static build completions.
  * **Cron-Driven:** Scheduled system sweeps execute at midnight (Daily) and Sundays (Weekly).
* **Isolation:** Each workflow is isolated. Gating loops run in sandboxed JavaScript threads with 90-second cumulative budgets.

---

## 3. Error Recovery and Escalation

* **Standard Gating Recovery:**
  * **Yellow Alert:** Content Re-Writer Agent attempts to patch content up to **3 consecutive times**.
  * **Red Alert:** Deploy & Recovery Agent resets local repository commits using git rollback strategies.
* **Escalation Rules:**
  * If the Content Re-Writer Agent runs 3 times without passing the score threshold, it exits, writes failure metadata, logs a `GatingFailedError` to SQLite, and blocks staging deploy.
  * If the Deploy & Recovery Agent fails to resolve a rollback (e.g., git tree corruption), the Governor locks the deploy server configurations and logs an emergency alarm on the event bus.
