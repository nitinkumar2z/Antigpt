# GUI Architecture — Control Center v1

## Overview

The **Antigravity Control Center** is a pure Node.js local GUI that serves as the primary operating interface for the Autonomous SEO Tool Factory. It exposes a 10-page single-page application at `http://localhost:5524`.

---

## Architecture Principles

| Principle | Decision |
|---|---|
| **Stack** | Pure Node.js (`http` built-in) + Vanilla HTML/CSS/JS |
| **No new dependencies** | Uses only what already exists in workspace |
| **Real data only** | All API reads from actual files, SQLite DB, git |
| **No faking** | If no runtime evidence → status = FAIL |
| **Port** | 5524 |

---

## Directory Structure

```
/root/control-center/
├── server.cjs          ← API server (Node.js CJS, no dependencies)
└── public/
    ├── index.html      ← SPA shell (10 pages)
    ├── styles.css      ← Premium dark UI design system
    └── app.js          ← Frontend logic (vanilla JS)
```

---

## Data Sources (Real Runtime Data)

| Dashboard | Data Source | File/Command |
|---|---|---|
| Overview | System status, tasks, git | `CURRENT_TASK.md`, `PROJECT_STATUS.md`, `git log` |
| MCP | Server directories + tool schemas | `.gemini/antigravity-cli/mcp/` |
| Plugins | Audit scores + source hooks | `reports/plugin-audit.md`, `src/plugins/*/index.ts` |
| Skills | Registry registration | `src/skills/index.ts` |
| Agents | Source class definitions + DB | `src/orchestrator/agents.ts`, `reports/factory.db` |
| Project | Pages count + DB jobs | `src/pages/tools/`, `reports/factory.db` |
| Logs | Live log files | `reports/dry-run.log`, `reports/plugin-audit.md` |
| GitHub | Git commands | `git log`, `git status`, `git remote` |
| Deployment | Dry-run log pattern match | `reports/dry-run.log` |
| Audit | Markdown audit files | `ARCHITECTURE_REPORT.md`, `RUNTIME_EVIDENCE_REPORT.md`, etc. |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Server health check |
| `/api/overview` | GET | System overview + current state |
| `/api/mcps` | GET | All MCP servers + tools |
| `/api/plugins` | GET | All 9 plugins with scores |
| `/api/skills` | GET | All 25 registered skills |
| `/api/agents` | GET | All 3 swarm agents |
| `/api/project` | GET | Project metrics |
| `/api/logs?source=X` | GET | Log lines from specified source |
| `/api/github` | GET | Git repo status |
| `/api/deployment` | GET | Cloudflare deployment status |
| `/api/audit` | GET | All 8 audit reports |
| `/api/logs/stream?source=X` | SSE | Live log streaming |

---

## Runtime Rules Enforced

1. **No fake data** — every field reads from disk/git/SQLite
2. **FAIL by default** — if file is missing or evidence absent, status = FAIL
3. **PASS requires evidence** — must appear in log file, DB, or source scan
4. **Real scores** — plugin scores from `reports/plugin-audit.md` parsed by section
5. **Real hooks** — extracted from `src/plugins/*/index.ts` source files
