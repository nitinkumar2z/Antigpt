# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Ongoing refactoring of remaining checks to use the centralized Skills Layer.

## [2026-06-06]
### Commit: `6f11d71` ("Initialize Project Control System")
- **Changes:**
  - Initialized Project Control System governance documentation (`PROJECT_STATUS.md`, `CURRENT_TASK.md`, `NEXT_TASK.md`, `ARCHITECTURE_REPORT.md`, `CHANGELOG.md`, `BACKLOG.md`).
  - Created web-based Project Control System dashboard (HTML, CSS, JS) and server runner (`server.cjs`).
  - Integrated System Governor simulation suites and whitelists.
- **Reason:** Make GitHub the single source of truth for repository health, release gates, and system architectures.

## [2026-06-05]
### Commit: `feat(governor): implement report generation, cron schedules, and gating policies`
- **Changes:**
  - Implemented the System Governor framework, event logging, and cron triggers.
- **Reason:** Prevent performance regressions and unauthorized MCP access loops.
