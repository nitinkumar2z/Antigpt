# Postgres Dependency Audit

## Postgres Used In:
- [src/plugins/register.ts](file:///root/src/plugins/register.ts#L71) (Listed in `MCP_SERVER_REGISTRY`)
- [src/plugins/engine/governor.ts](file:///root/src/plugins/engine/governor.ts#L39) (Whitelisted under `mcpAccessWhiteList` for `tool-planner` and `weekly-seo-engine`)
- [src/plugins/tool-planner/index.ts](file:///root/src/plugins/tool-planner/index.ts#L48) (Declared in `mcpDependencies` metadata)
- [src/plugins/weekly-seo-engine/index.ts](file:///root/src/plugins/weekly-seo-engine/index.ts#L25) (Declared in `mcpDependencies` metadata)
- [src/skills/db/relational.ts](file:///root/src/skills/db/relational.ts#L9) (TypeScript type/interface check for schema audits; no runtime driver usage)

## Production Critical:
**NO**

## Can Tool Factory / Plugin Engine Run Without Postgres:
**YES**

## Classification:
**Optional**

## Detailed Findings:
1. **No Runtime Database Invocations:** A repository-wide check verifies there are zero `callMcpTool('postgres', ...)` calls in the entire codebase. The plugin engine exclusively communicates with the `sqlite` and `memory` MCP servers at runtime.
2. **Metadata-Only Dependency:** The references in `tool-planner` and `weekly-seo-engine` are metadata declarations only. These plugins do not make any database queries or invoke the `postgres` MCP server at runtime.
3. **No External Client Dependencies:** There are no Postgres-related client libraries (e.g., `pg`, `postgres`) declared in [package.json](file:///root/package.json).
4. **Current Status of Server:** The postgres MCP server fails validation (`Output Proof` and `Runtime Execution Proof`) due to connection failure, as there is no live PostgreSQL instance running in this sandbox.

## Recommended Action:
Remove `postgres` from the configuration to reduce configuration overhead and resolve the MCP Layer verification failure:
- Remove `'postgres'` from `MCP_SERVER_REGISTRY` in [src/plugins/register.ts](file:///root/src/plugins/register.ts#L71).
- Remove `postgres` mapping from `mcpAccessWhiteList` in [src/plugins/engine/governor.ts](file:///root/src/plugins/engine/governor.ts#L39).
- Remove `'postgres'` from `mcpDependencies` in [src/plugins/tool-planner/index.ts](file:///root/src/plugins/tool-planner/index.ts#L48).
- Remove `'postgres'` from `mcpDependencies` in [src/plugins/weekly-seo-engine/index.ts](file:///root/src/plugins/weekly-seo-engine/index.ts#L25).

## Adjusted MCP Score:
- **Baseline Score:** 66.6% (6/9 servers fully proven: `github`, `cloudflare`, `sqlite`, `memory`, `playwright`, `context7`)
- **Adjusted Score (Postgres Removed):** 75.0% (6/8 servers fully proven)
- **Adjusted Score (Both Postgres & Context7 Removed):** 71.4% (5/7 servers fully proven: `github`, `cloudflare`, `sqlite`, `memory`, `playwright`)
