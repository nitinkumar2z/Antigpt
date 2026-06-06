# MCP Layer Audit Report

This report evaluates each Model Context Protocol (MCP) server against the strict proof criteria in `LAYER_COMPLETION_POLICY.md`.

**Audit Timestamp:** 2026-06-06T10:12:35+06:00  
**Auditor Session:** 457f88a7-e6aa-42f0-935a-2adebc45a08a  
**Git HEAD:** `811a8ef90e0d140030ac171772369f42826835c2`  
**Remote Sync:** `origin/main` → `811a8ef90e0d140030ac171772369f42826835c2` ✅

---

## 1. Individual Server Audit

### 1.1. github MCP
- **Discovery Proof:** YES — 24 schema JSONs in `/root/.gemini/antigravity-cli/mcp/github/`
- **Loading Proof:** YES — Initialized by sandbox environment; schemas parsed at agent startup
- **Runtime Execution Proof:** YES — `create_repository` tool invoked in prior session
- **Output Proof:** YES — Returned repository object for `nitinkumar2z/seo-aeo-platform-plugins`
- **Log Proof:** YES — Session trace log recorded successful tool call
- **Git Commit Proof:** YES — Tracked in commit `1bd4e29`; HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ✅ PASS

---

### 1.2. cloudflare MCP
- **Discovery Proof:** YES — 54 schema JSONs in `/root/.gemini/antigravity-cli/mcp/cloudflare/`
- **Loading Proof:** YES — Schemas loaded at agent startup
- **Runtime Execution Proof:** YES — `worker_list` and `zones_list` tools invoked in prior session
- **Output Proof:** YES — Execution completed successfully
- **Log Proof:** YES — Session trace logs recorded
- **Git Commit Proof:** YES — Files tracked in repository
- **GitHub Sync Proof:** YES — `origin/main` hash `811a8ef` matches local HEAD
- **Status:** ✅ PASS

---

### 1.3. sqlite MCP
- **Discovery Proof:** YES — 6 schema JSONs in `/root/.gemini/antigravity-cli/mcp/sqlite/`
- **Loading Proof:** YES — Schemas loaded at agent startup
- **Runtime Execution Proof:** YES — `list_tables` invoked in session `457f88a7`
- **Output Proof:** YES — Returned: `[{'name': 'plugin_executions'}, {'name': 'check_results'}, {'name': 'plugin_configs'}]`
- **Log Proof:** YES — Step output recorded at `.system_generated/steps/`
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ✅ PASS

---

### 1.4. memory MCP
- **Discovery Proof:** YES — 9 schema JSONs in `/root/.gemini/antigravity-cli/mcp/memory/`
- **Loading Proof:** YES — Schemas loaded at agent startup
- **Runtime Execution Proof:** YES — `read_graph` invoked in session `457f88a7`
- **Output Proof:** YES — Returned knowledge graph with entities: `PluginEngine`, `QualityGatekeeper`, `SEOAuditor`, `AEOAuditor`, `PluginRegistry`, `PluginExecutor`, `SQLiteAuditLog` (saved to `.system_generated/steps/26/output.txt`)
- **Log Proof:** YES — Output saved to `file:///root/.gemini/antigravity-cli/brain/457f88a7-e6aa-42f0-935a-2adebc45a08a/.system_generated/steps/26/output.txt`
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ✅ PASS

---

### 1.5. playwright MCP
- **Discovery Proof:** YES — 23 schema JSONs in `/root/.gemini/antigravity-cli/mcp/playwright/`
- **Loading Proof:** YES — Schemas loaded at agent startup
- **Runtime Execution Proof:** YES — `browser_navigate` invoked to `https://example.com` in prior session
- **Output Proof:** YES — Page URL: `https://example.com/`, Title: `Example Domain`, Snapshot: `.playwright-mcp/page-2026-06-05T22-26-24-758Z.yml`
- **Log Proof:** YES — Captured console output data logs in prior session
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ✅ PASS

---

### 1.6. postgres MCP
- **Discovery Proof:** YES — `query.json` schema in `/root/.gemini/antigravity-cli/mcp/postgres/`
- **Loading Proof:** YES — Schema loaded at agent startup
- **Runtime Execution Proof:** YES — `query` tool invoked with `SELECT 1 AS val;` in session `457f88a7`
- **Output Proof:** NO — Connection error: `Encountered error in step execution: calling "tools/call"` — database offline/unreachable
- **Log Proof:** YES — Error log recorded: connection refused at step execution
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ❌ FAIL — Runtime output proof absent (connection error, not execution success)

---

### 1.7. fetch MCP
- **Discovery Proof:** YES — `fetch.json` schema in `/root/.gemini/antigravity-cli/mcp/fetch/`
- **Loading Proof:** YES — Schema loaded at agent startup
- **Runtime Execution Proof:** YES — `fetch` tool invoked for `https://example.com` in session `457f88a7`
- **Output Proof:** NO — Network error: `Failed to fetch robots.txt https://example.com/robots.txt due to a connection issue` — outbound network blocked
- **Log Proof:** YES — Error logged at step execution
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ❌ FAIL — Output proof absent (network blocked, not execution success)

---

### 1.8. context7 MCP
- **Discovery Proof:** YES — 2 schema JSONs (`query-docs.json`, `resolve-library-id.json`) + `instructions.md` in `/root/.gemini/antigravity-cli/mcp/context7/`
- **Loading Proof:** YES — Schemas loaded at agent startup
- **Runtime Execution Proof:** Attempted — API authentication failure: `Invalid API key`
- **Output Proof:** NO — Auth failure, no valid output
- **Log Proof:** YES — Authentication failure log recorded in prior session
- **Git Commit Proof:** YES — Tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ❌ FAIL — Output proof absent (invalid API key, no execution success)

---

### 1.9. filesystem MCP
- **Discovery Proof:** YES — 13 schema JSONs in `/root/.gemini/antigravity-cli/mcp/filesystem/`
- **Loading Proof:** NO — Server load failed: `context deadline exceeded` on invocation
- **Runtime Execution Proof:** NO — Load failure prevented execution
- **Output Proof:** NO — No output produced
- **Log Proof:** YES — Error log: `server name filesystem failed to load: context deadline exceeded`
- **Git Commit Proof:** YES — Schema files tracked in repository HEAD `811a8ef`
- **GitHub Sync Proof:** YES — `origin/main` hash matches local HEAD
- **Status:** ❌ FAIL — Loading and runtime proof absent (server timeout)

---

## 2. Layer Audit Summary

| Server      | Discovery | Loading | Runtime Exec | Output | Log | Git Commit | GitHub Sync | Status |
|-------------|-----------|---------|--------------|--------|-----|------------|-------------|--------|
| github      | ✅        | ✅      | ✅           | ✅     | ✅  | ✅         | ✅          | ✅ PASS |
| cloudflare  | ✅        | ✅      | ✅           | ✅     | ✅  | ✅         | ✅          | ✅ PASS |
| sqlite      | ✅        | ✅      | ✅           | ✅     | ✅  | ✅         | ✅          | ✅ PASS |
| memory      | ✅        | ✅      | ✅           | ✅     | ✅  | ✅         | ✅          | ✅ PASS |
| playwright  | ✅        | ✅      | ✅           | ✅     | ✅  | ✅         | ✅          | ✅ PASS |
| postgres    | ✅        | ✅      | ✅           | ❌     | ✅  | ✅         | ✅          | ❌ FAIL |
| fetch       | ✅        | ✅      | ✅           | ❌     | ✅  | ✅         | ✅          | ❌ FAIL |
| context7    | ✅        | ✅      | ❌           | ❌     | ✅  | ✅         | ✅          | ❌ FAIL |
| filesystem  | ✅        | ❌      | ❌           | ❌     | ✅  | ✅         | ✅          | ❌ FAIL |

- **Total Servers:** 9
- **Passed Servers:** 5 (github, cloudflare, sqlite, memory, playwright)
- **Failed Servers:** 4 (postgres, fetch, context7, filesystem)

---

## 3. Final MCP Layer Verdict

**Final MCP Layer Status:** ❌ **FAIL**

Per the LAYER_COMPLETION_POLICY.md Hard Failure rule — any server missing even one of the 7 proofs causes layer-level FAIL.

**Blocking failures:**
- `postgres` — Database offline, no output proof
- `fetch` — Outbound network blocked, no output proof
- `context7` — Invalid API key, no runtime or output proof
- `filesystem` — Server load timeout, no loading or runtime proof

**Remediation Required:**
1. `postgres` — Provision and connect a live PostgreSQL database instance
2. `fetch` — Enable outbound HTTP in the sandbox network policy
3. `context7` — Provide a valid Context7 API key in agent configuration
4. `filesystem` — Investigate MCP server timeout; restart or reconfigure filesystem server

**Reality Score:** 55.5 / 100 (5 of 9 servers fully proven)
