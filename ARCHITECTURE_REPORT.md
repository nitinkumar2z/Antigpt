# Architecture Report

This report outlines the structural layers and execution workflows of the SEO/AEO Platform.

---

## MCP Layer
The Model Context Protocol (MCP) layer handles connection to external tools and databases through standard API adapters.
- **`context7`:** Documentation reference resolution.
- **`fetch`:** Network scraping and RSS checks.
- **`memory`:** Knowledge Graph state tracking.
- **`postgres`:** Site operational analytics database.
- **`sqlite`:** Local audit logs DB (`plugins.db`).
- **`playwright`:** Browser automation checks.
- **`github`:** Repository and branch status querying.
- **`cloudflare`:** Staging/Production edge deployments monitoring.

---

## Plugin Layer
The plugin layer coordinates checks bound to distinct lifecycle hooks:
- **`pre-publish`:** Safety gate checks executing prior to live sync.
- **`post-build`:** Site audits evaluating built HTML output artifacts.
- **`on-schedule`:** Periodic monitoring and cleanup audits (daily/weekly).
- **Core Plugins:** `quality-gatekeeper`, `seo-auditor`, `aeo-auditor`, `tool-research-engine`, `tool-planner`, `qa-automation`, `deployment-guardian`, `google-update-engine`, `weekly-seo-engine`.

---

## Governor Layer
The System Governor layer intercepts execution workflows, regulating execution properties:
- **Dependency Access Whitelists:** Prevents unauthorized plugins from invoking restricted MCP tools.
- **Time budgets:** Enforces limits of 30 seconds per plugin and a cumulative budget of 90 seconds per hook sequence.
- **Publish Gating Bands:**
  - **Red (< 700):** REJECT. Halts build and triggers auto-rollback loop.
  - **Yellow (700-799):** NEEDS FIX. Deploys to staging only, alerts the Content Re-Writer Agent.
  - **Green (>= 800):** PUBLISH. Approved for production deploy and tags Git release.

---

## Skills Layer
The Skills layer abstracts utility algorithms into reusable, standalone contracts:
- **Text & Linguistics:** Readability scoring, duplicate checking (n-grams), semantic alignment.
- **HTML & DOM Analysis:** Structure audits, JSON-LD parsing, canonical link checks.
- **Browser & Network Integrations:** Headless page rendering, XML feed scraping.
- **Scoring standard:** Normalised 0-100 score return with robust offline fallback modes.

---

## Agent Layer
Autonomous agents leverage plugins and skills to heal content discrepancies:
- **Content Re-Writer Agent:** Refactors failing content templates until they score above gating thresholds.
- **Deploy & Recovery Agent:** Rolls back production releases to stable tagged commits on critical build failures.
- **Trend Discovery Agent:** Identifies emerging keywords, proposing page creation plans.

---

## Workflow Layer
Integrated execution flows automate content optimization:
- **Self-Healing Publishing Loop:**
  `Draft Content -> Gating (Fail) -> Content Re-Writer Agent -> Re-Scored (Pass) -> Auto-Commit & Push`
- **Algorithm Update Adaptability Loop:**
  `Scheduled Run -> RSS Scraping -> Vulnerability Mapping -> Content Patch -> Redeploy`

---

## Deployment Layer
The deployment infrastructure targets Cloudflare Pages and Edge Workers:
- **Staging environment:** Automated build triggered on main branch updates.
- **Production environment:** Restricts updates to verified, Green-band tagged release versions (`plugin-layer-v1`).
- **Safety checks:** Size limits validation, API token scopes audit.
