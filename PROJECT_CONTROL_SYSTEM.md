# Project Control System & Governance Guidelines

This document details the Project Control System and operational workflows designed to make GitHub the single source of truth for repository progress.

---

## 1. Project Governance Rules
A task is **NOT** considered complete until all the following criteria are satisfied:

1. **✓ Code Exists:** All required files are created, refactored, or written, satisfying TypeScript type safety and lint limits.
2. **✓ Runtime Proof Exists:** Code runs successfully in its runtime environment, producing verified console logs or test outcomes.
3. **✓ Audit Passed:** Custom gating tests, typechecking, and validations (`npm run validate`) run successfully with zero errors.
4. **✓ `PROJECT_STATUS.md` Updated:** Current phase, components status, and system scores are synced.
5. **✓ `CHANGELOG.md` Updated:** Entry describing dates, changes, and reasons is appended.
6. **✓ Git Commit Created:** Changes are committed locally with a descriptive commit message.
7. **✓ Git Push Completed:** Code is pushed to GitHub to preserve repository integrity.

---

## 2. Automated Status Update Workflow
Immediately after finishing any task, the following files must be updated:

- **`PROJECT_STATUS.md`:** Sync Completed and In Progress lists, verify System Health Score, update Last Commit hash and Last Updated timestamp.
- **`CHANGELOG.md`:** Add a new entry outlining the change details and architectural rationale.
- **`CURRENT_TASK.md`:** Update the objective, current steps, and dependencies.
- **`NEXT_TASK.md`:** Recalculate immediate next actions and priorities.

---

## 3. Web Dashboard integration
The system includes a static-served HTML Project Control Dashboard to visually audit the governance process:
- **Kanban Board:** Interactively tracks tasks across To Do, In Progress, In Review, and Done columns.
- **Gating Simulator:** Live scoring console highlighting rollback triggers and Content Re-Writer alerts.
- **Governor Shield:** Real-time whitelisting rules visualizer and security breach simulator.

Run the dashboard locally:
```bash
npm run control-system
```
Access the dashboard at: `http://localhost:3000`
