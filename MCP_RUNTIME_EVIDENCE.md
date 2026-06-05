# MCP Runtime Evidence Log

This document lists the runtime validation evidence and execution logs for the 8 available Model Context Protocol (MCP) servers.

---

## 1. Verified Executions Log

### 1.1. github
- **Status:** PASS
- **Execution Proof:** Run `create_repository` tool during project control remote setup.
- **Output Evidence:** Successful creation of `nitinkumar2z/seo-aeo-platform-plugins` repository.
- **Log Evidence:** Recorded in stdout session trace logs.

### 1.2. cloudflare
- **Status:** PASS
- **Execution Proof:** Run `worker_list` and `zones_list` tools.
- **Output Evidence:** Output successfully completed.
- **Log Evidence:** Session trace logs.

### 1.3. sqlite
- **Status:** PASS
- **Execution Proof:** Run `list_tables` tool.
- **Output Evidence:**
  ```json
  [
    {"name": "plugin_executions"},
    {"name": "check_results"},
    {"name": "plugin_configs"}
  ]
  ```
- **Log Evidence:** Session trace logs.

### 1.4. playwright
- **Status:** PASS
- **Execution Proof:** Run `browser_navigate` tool to `https://example.com`.
- **Output Evidence:**
  * Page URL: `https://example.com/`
  * Page Title: `Example Domain`
  * Snapshot path: `.playwright-mcp/page-2026-06-05T22-26-24-758Z.yml`
- **Log Evidence:** Captured output console data logs.

### 1.5. memory
- **Status:** PASS
- **Execution Proof:** Run `read_graph` tool.
- **Output Evidence:** Returned knowledge graph with entities: `PluginEngine`, `QualityGatekeeper`, `SEOAuditor`, `AEOAuditor`, `PluginRegistry`, `PluginExecutor`, `SQLiteAuditLog`.
- **Log Evidence:** Output written to path `file:///root/.gemini/antigravity-cli/brain/24529b80-4320-4dc7-81c3-8bc48e4e1212/.system_generated/steps/409/output.txt`.

### 1.6. postgres
- **Status:** FAIL
- **Execution Proof:** Run `query` tool with `sql: "SELECT 1 as val;"`.
- **Output Evidence:** Empty error returned.
- **Log Evidence:** Offline connection error logs.

### 1.7. fetch
- **Status:** FAIL
- **Execution Proof:** Run `fetch` tool for `https://example.com`.
- **Output Evidence:** Outbound connection issue fetching `robots.txt`.
- **Log Evidence:** Network blocked logs.

### 1.8. context7
- **Status:** FAIL
- **Execution Proof:** Run `query-docs` tool.
- **Output Evidence:** `Invalid API key` validation error.
- **Log Evidence:** Authentication failure logs.

---

## 2. Scorecard

- **Total Servers:** 8
- **Passed:** 5 (github, cloudflare, sqlite, playwright, memory)
- **Failed:** 3 (postgres, fetch, context7)

**Final MCP Reality Score:** **62.5 / 100**
