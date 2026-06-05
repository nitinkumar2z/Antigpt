# Production Plugin Layer — Universal Audit Framework

This document defines the **Audit Layer** and the **Universal Scoring Framework** for the SEO/AEO autonomous platform. It establishes the criteria, workflows, and reporting structures required to enforce platform health, compliance, and revenue performance.

---

## 1. Universal Scoring Framework (0-1000)

All page evaluations, content updates, and deployment gates are scored against a standard composite scale totaling `1000` points.

```
       UNIVERSAL COMPOSITE SCORE: 1000 POINTS MAX
┌───────────────────────────────────────┬──────────────┐
│ Category                              │ Max Points   │
├───────────────────────────────────────┼──────────────┤
│ 1. Technical Score                    │ /200         │
│ 2. SEO Score                          │ /200         │
│ 3. AEO Score                          │ /200         │
│ 4. UX Score                           │ /200         │
│ 5. Revenue Score                      │ /100         │
│ 6. Automation Score                   │ /100         │
└───────────────────────────────────────┴──────────────┘
```

### 1.1. Technical Score (/200)
Evaluates code correctness, build compatibility, and execution integrity.
*   **TypeScript / Compilation (50 pts):** Clean strict builds, zero compile warnings.
*   **Schema Relational Check (50 pts):** Valid foreign keys and indexes.
*   **Bundle Size Gating (50 pts):** Cloudflare Worker files under 1MB.
*   **Error Rate (50 pts):** Zero runtime/console errors during Playwright rendering audits.

### 1.2. SEO Score (/200)
Measures search engine crawlability and relevance indicators.
*   **Meta Elements (50 pts):** Accurate canonicals, titles, and descriptions.
*   **Indexability Outline (50 pts):** Correct robots.txt and sitemap pointers.
*   **Structural Semantics (50 pts):** Heading hierarchies and structural lists.
*   **Link Hygiene (50 pts):** Internal links density and zero broken link syntaxes.

### 1.3. AEO Score (/200)
Rates conversational engine retrieval compatibility (Gemini, SearchGPT, Perplexity).
*   **Direct Answers (60 pts):** Quotable summaries in the first 150 words.
*   **Entity Mapping (50 pts):** Microdata entity densities and Wikidata reference links.
*   **conversational Headings (50 pts):** Q&A phrasing patterns.
*   **LLM Declarations (40 pts):** Presence of speakable schema tags and `/llms.txt` config.

### 1.4. UX Score (/200)
Measures layout usability, page speed indicators, and accessibility.
*   **Core Web Vitals (70 pts):** Page load times and cumulative layout shifts.
*   **WCAG Accessibility (70 pts):** ARIA roles, color contrast, and skip-nav links.
*   **Functional Testing (60 pts):** JavaScript execution compatibility.

### 1.5. Revenue Score (/100)
Protects monetization channels and improves traffic conversion rates.
*   **AdSense Compliance (50 pts):** Checks for thin content, placeholder copy, or copyright violations.
*   **CTA Density (50 pts):** Verifies correct ad units distribution and call-to-action blocks.

### 1.6. Automation Score (/100)
Measures pipeline efficiency, dependency health, and rollback safety.
*   **MCP Connectivity (50 pts):** 100% active socket rates across whitelisted MCP interfaces.
*   **Git Lifecycle Compliance (50 pts):** Version tags exist, clean workspace states.

---

## 2. Automated Audit Workflows

The governor executes six dedicated audit workflows, outputting structured reports to `/reports/`.

```
                  Automated Audit Execution
                      ┌───────────────┐
                      │ Hook Trigger  │
                      └───────┬───────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     [ Plugin Audit ]  [ Skill Audit ]   [ Agent Audit ]
            │                 │                 │
            ▼                 ▼                 ▼
      [ SEO Audit ]    [ Deploy Audit ]  [ Revenue Audit ]
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Generate Reports      │
                  │  - daily-system.md    │
                  │  - plugin/skill.md    │
                  │  - agent/seo.md       │
                  │  - deployment.md      │
                  └───────────────────────┘
```

### 2.1. Plugin Audit Workflow
*   **Objective:** Verifies registration validity, lifecycle health, and event compliance.
*   **Checks:** Verifies all 9 plugins compile, registers without duplicate names, and resolves errors cleanly.
*   **Trigger:** Nightly at 2:00 AM.
*   **Artifact Report:** `reports/plugin-audit.md`

### 2.2. Skill Audit Workflow
*   **Objective:** Tests input/output shapes and verifies boundary limits of the 15 production skills.
*   **Checks:** Runs unit mocks validating recovery fallbacks if dependency MCP servers are simulated offline.
*   **Trigger:** Weekly on Sundays at 3:00 AM.
*   **Artifact Report:** `reports/skill-audit.md`

### 2.3. Agent Audit Workflow
*   **Objective:** Inspects subagent log files and tracks memory operations.
*   **Checks:** Reads conversation logs (`/brain/<id>/.system_generated/logs/transcript.jsonl`) to track agent execution errors, loop times, and tool calls.
*   **Trigger:** Weekly on Sundays at 3:00 AM.
*   **Artifact Report:** `reports/agent-audit.md`

### 2.4. SEO Audit Workflow
*   **Objective:** Audits site-wide technical crawlability and index readiness.
*   **Checks:** Analyzes canonical structures, internal anchors, and metadata attributes.
*   **Trigger:** Nightly at 2:00 AM.
*   **Artifact Report:** `reports/seo-audit.md`

### 2.5. Cloudflare Deployment Audit Workflow
*   **Objective:** Guards edge routing limits and size constraints.
*   **Checks:** Measures bundle sizes, checks staging environment flags, and verifies active deployment statuses.
*   **Trigger:** Pre-publish Hook / Git Commit Stage.
*   **Artifact Report:** `reports/deployment-audit.md`

### 2.6. Revenue Optimization Audit Workflow
*   **Objective:** Optimizes page configurations for AdSense earnings.
*   **Checks:** Identifies pages missing AdSense codes, checks layout spacing around ad blocks, and flags thin content.
*   **Trigger:** Weekly on Sundays at 3:00 AM.
*   **Artifact Report:** Generated inside `reports/daily-system-report.md`.

---

## 3. Generated Report Specifications

All reports are generated in standardized Markdown format inside `/reports/`.

### 3.1. `reports/daily-system-report.md`
A high-level dashboard indicating overall system health.
*   **Contents:**
    1.  Platform Status: Green (Active) / Yellow (Degraded) / Red (Fatal).
    2.  Active plugin count and compile verify status.
    3.  Summary of Google Update monitoring results.
    4.  System Governor budget usage statistics.

### 3.2. `reports/plugin-audit.md`
A detailed verification register of the plugin system.
*   **Contents:**
    1.  Plugin scorecard (Composite scores, active checks, status).
    2.  List of policy violations or warnings (e.g. timeout warnings).
    3.  Hook binding maps.

### 3.3. `reports/skill-audit.md`
A checklist detailing performance across all 15 skills.
*   **Contents:**
    1.  List of active skills and their execution priorities.
    2.  Mock tests results for offline fallbacks.
    3.  Average execution latency per skill.

### 3.4. `reports/agent-audit.md`
Diagnostics of active subagent conversations.
*   **Contents:**
    1.  Active subagents summary (Conversation ID, type, role).
    2.  Execution error rates and tool usage distribution.
    3.  Memory graph observation count.

### 3.5. `reports/seo-audit.md`
Detailed crawlability scorecard.
*   **Contents:**
    1.  Average SEO and AEO scores.
    2.  Details of pages flagging keyword stuffing or thin content.
    3.  Canonical tag compliance audits.

### 3.6. `reports/deployment-audit.md`
Release checklist.
*   **Contents:**
    1.  Worker file sizes and Cloudflare environment variables mappings.
    2.  GitHub Actions build logs summary.
    3.  Rollback safety verification tests results.
