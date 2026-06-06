# Core Engine Layered Architecture & Execution Flow

This document specifies the technical layers of the **Core Engine** and the step-by-step pipeline of the **Tool Execution Flow**.

---

## 1. Core Engine Topology (8 Layers)

The platform is designed as an 8-layer structural stack, separating concerns from low-level execution context to high-level automation:

```
┌─────────────────────────────────────────────────────────┐
│                     Recovery Layer                      │
├─────────────────────────────────────────────────────────┤
│                      Deploy Layer                       │
├─────────────────────────────────────────────────────────┤
│                     Scheduler Layer                     │
├─────────────────────────────────────────────────────────┤
│                       Agent Layer                       │
├─────────────────────────────────────────────────────────┤
│                       Skill Layer                       │
├─────────────────────────────────────────────────────────┤
│                     Governor Layer                      │
├─────────────────────────────────────────────────────────┤
│                      Plugin Layer                       │
├─────────────────────────────────────────────────────────┤
│                        MCP Layer                        │
└─────────────────────────────────────────────────────────┘
```

### Layer Details:
1.  **MCP Layer:** Provides secure execution interfaces to host platforms (e.g. `sqlite`, `postgres`, `fetch`, `cloudflare`, `github`, `playwright`).
2.  **Plugin Layer:** Houses the 9 production plugins and their corresponding 47 checks evaluating readability, meta tags, and structured schemas.
3.  **Governor Layer:** The gatekeeper enforcing time budgets (30s/90s), whitelisting permissions, and score gating bands.
4.  **Skill Layer:** The centralized de-duplicated logic registry (15 production skills) consumed by plugins and agents alike.
5.  **Agent Layer:** Coordinates task cycles using active swarms (e.g. `TrendDiscoveryAgent`, `ContentReWriterAgent`, `DeployRecoveryAgent`).
6.  **Scheduler Layer:** Manages daily cron routines and weekly audits.
7.  **Deploy Layer:** Interacts with Cloudflare Pages serverless configurations.
8.  **Recovery Layer:** Manages forced git rollbacks to previous stable tags during pipeline failures.

---

## 2. Tool Execution Flow (8 Engines)

The programmatic factory pipeline consists of 8 sequential engine phases:

```
[Research] ──> [Planning] ──> [Build] ──> [QA] 
           ──> [Deploy] ──> [Tracking] ──> [Revenue] ──> [Optimization]
```

### Stage Contracts:
*   **1. Research Engine:** Identifies search intent patterns, competitor keywords, and scrapes niching trends.
*   **2. Planning Engine:** Models SQLite database schemas, structures scope parameters, and plans Astro paths.
*   **3. Build Engine:** Generates source page code, CSS layouts, and client JS logic using AST compilers.
*   **4. QA Engine:** Validates page structures using playwright headless renderings, WCAG contrast audits, and links validations.
*   **5. Deploy Engine:** Pushes commits to remote GitHub branches and stages edge promotions on Cloudflare.
*   **6. Tracking Engine:** Registers sitemaps and monitors indexing coverage using Google Search Console APIs.
*   **7. Revenue Engine:** Audits AdSense viability guidelines and estimates ad placements density.
*   **8. Optimization Engine:** Periodically checks content freshness, checks readability scores, and rewrites weak segments.
