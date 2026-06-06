# GUI Task List — Control Center v1

## Build Tasks

| # | Task | Status | File |
|---|---|---|---|
| 1 | Create control-center directory structure | ✅ DONE | `control-center/` |
| 2 | Build Node.js API server on port 5524 | ✅ DONE | `control-center/server.cjs` |
| 3 | Implement `/api/health` endpoint | ✅ DONE | server.cjs |
| 4 | Implement `/api/overview` — system status | ✅ DONE | server.cjs |
| 5 | Implement `/api/mcps` — MCP server inventory | ✅ DONE | server.cjs |
| 6 | Implement `/api/plugins` — plugin scores + hooks | ✅ DONE | server.cjs |
| 7 | Implement `/api/skills` — skill registry | ✅ DONE | server.cjs |
| 8 | Implement `/api/agents` — agent states | ✅ DONE | server.cjs |
| 9 | Implement `/api/project` — build metrics | ✅ DONE | server.cjs |
| 10 | Implement `/api/logs?source=X` — log viewer | ✅ DONE | server.cjs |
| 11 | Implement `/api/github` — git status | ✅ DONE | server.cjs |
| 12 | Implement `/api/deployment` — Cloudflare status | ✅ DONE | server.cjs |
| 13 | Implement `/api/audit` — audit reports | ✅ DONE | server.cjs |
| 14 | Build premium dark design system | ✅ DONE | `public/styles.css` |
| 15 | Build SPA shell HTML with 10 pages | ✅ DONE | `public/index.html` |
| 16 | Build frontend app logic (vanilla JS) | ✅ DONE | `public/app.js` |
| 17 | Page 1: Overview dashboard | ✅ DONE | app.js:loadOverview() |
| 18 | Page 2: MCP Dashboard | ✅ DONE | app.js:loadMcp() |
| 19 | Page 3: Plugin Dashboard | ✅ DONE | app.js:loadPlugins() |
| 20 | Page 4: Skills Dashboard | ✅ DONE | app.js:loadSkills() |
| 21 | Page 5: Agent Dashboard | ✅ DONE | app.js:loadAgents() |
| 22 | Page 6: Project Dashboard | ✅ DONE | app.js:loadProject() |
| 23 | Page 7: Logs Viewer (live polling) | ✅ DONE | app.js:loadLogs() |
| 24 | Page 8: GitHub Dashboard | ✅ DONE | app.js:loadGithub() |
| 25 | Page 9: Deployment Dashboard | ✅ DONE | app.js:loadDeployment() |
| 26 | Page 10: Audit Dashboard | ✅ DONE | app.js:loadAudit() |
| 27 | Add `npm run control-center` + `npm run cc` scripts | ✅ DONE | `package.json` |
| 28 | Fix plugin score parser (plugin-audit.md format) | ✅ DONE | server.cjs:parsePluginSection() |
| 29 | Fix hook extraction from index.ts source files | ✅ DONE | server.cjs:collectPlugins() |
| 30 | Write GUI_ARCHITECTURE.md | ✅ DONE | `GUI_ARCHITECTURE.md` |
| 31 | Write GUI_IMPLEMENTATION_PLAN.md | ✅ DONE | `GUI_IMPLEMENTATION_PLAN.md` |
| 32 | Write GUI_TASK_LIST.md | ✅ DONE | `GUI_TASK_LIST.md` |
| 33 | Run typecheck | ✅ PASS | `npm run typecheck` |
| 34 | Run validation | ✅ PASS | `npm run validate` |
| 35 | Verify all 11 API endpoints return 200 | ✅ PASS | curl tests |
| 36 | Verify all 3 static files serve correctly | ✅ PASS | curl tests |
| 37 | Commit to git | ✅ DONE | origin/main |

## How to Start

```bash
# From /root
npm run cc

# Or directly
node control-center/server.cjs
```

Then open: **http://localhost:5524**

## Runtime Verification Checklist

- [x] `GET /api/health` → `{"status":"OK"}`
- [x] `GET /api/overview` → systemStatus, runtimeStatus, commit, agents, MCPs
- [x] `GET /api/plugins` → 9 plugins with real scores and hooks
- [x] `GET /api/skills` → 25 registered skills
- [x] `GET /api/agents` → 3 agents with evidence flags
- [x] `GET /api/mcps` → 9 MCP servers with tool counts
- [x] `GET /api/project` → tool count, pages, deployments
- [x] `GET /api/github` → real git branch/commit/sync
- [x] `GET /api/deployment` → Cloudflare staging URLs
- [x] `GET /api/audit` → 8 audit report statuses
- [x] `GET /api/logs?source=all` → live log lines
