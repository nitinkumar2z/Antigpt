# Fetch Dependency Audit

## Fetch Used In:
- [src/plugins/register.ts](file:///root/src/plugins/register.ts#L69) (Listed in `MCP_SERVER_REGISTRY`)
- [src/plugins/tool-research-engine/index.ts](file:///root/src/plugins/tool-research-engine/index.ts#L25) (Declared in `mcpDependencies` metadata)
- [src/plugins/google-update-engine/index.ts](file:///root/src/plugins/google-update-engine/index.ts#L55) (Declared in `mcpDependencies` metadata)
- [src/plugins/weekly-seo-engine/index.ts](file:///root/src/plugins/weekly-seo-engine/index.ts#L25) (Declared in `mcpDependencies` metadata)

## Production Critical:
**NO**

## Can Tool Factory / Plugin Engine Run Without Fetch:
**YES**

## Classification:
**Optional**

## Detailed Findings:
1. **No Runtime Database or API Invocations:** There are zero `callMcpTool('fetch', ...)` calls in the entire codebase. The plugins and checks only process local HTML and context data, or simulate external requests in-memory.
2. **Not Whitelisted in Governor:** The `fetch` MCP server is not whitelisted under the `mcpAccessWhiteList` configuration inside [src/plugins/engine/governor.ts](file:///root/src/plugins/engine/governor.ts). If any plugin attempted to run it, the governor would block it by default.
3. **Covered by Native Alternatives:** Modern Node.js provides a robust built-in `fetch` API. For visual or complex browser rendering, the project uses the `playwright` MCP server. Therefore, the external `fetch` MCP server is redundant.
4. **Current Status of Server:** The `fetch` MCP server fails validation due to network blocking or outbound sandbox limits.

## Recommended Action:
Remove `fetch` from the configurations to eliminate verification overhead and resolve the MCP Layer validation failure:
- Remove `'fetch'` from `MCP_SERVER_REGISTRY` in [src/plugins/register.ts](file:///root/src/plugins/register.ts#L69).
- Remove `'fetch'` from `mcpDependencies` in [src/plugins/tool-research-engine/index.ts](file:///root/src/plugins/tool-research-engine/index.ts#L25).
- Remove `'fetch'` from `mcpDependencies` in [src/plugins/google-update-engine/index.ts](file:///root/src/plugins/google-update-engine/index.ts#L55).
- Remove `'fetch'` from `mcpDependencies` in [src/plugins/weekly-seo-engine/index.ts](file:///root/src/plugins/weekly-seo-engine/index.ts#L25).

## Adjusted MCP Score:
- **Baseline Score:** 75.0% (6/8 servers fully proven: `github`, `cloudflare`, `sqlite`, `memory`, `playwright`, `context7`)
- **Adjusted Score (Fetch Removed):** 85.7% (6/7 servers fully proven)
- **Adjusted Score (Both Fetch & Postgres Removed):** 100.0% (6/6 servers fully proven: `github`, `cloudflare`, `sqlite`, `memory`, `playwright`, `context7`)
