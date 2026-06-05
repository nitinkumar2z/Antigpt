# Production Plugin Layer — Skills Layer Architecture

> **Document Version:** v1.0.0  
> **Status:** Architecture Design Only (Code creation deferred)  
> **Target Folder:** `/src/skills/`  

---

## 1. Skills Architecture Overview

The skills layer is the foundational service engine of the platform. It abstracts low-level utilities and external integrations from the plugin definitions. 

```
┌────────────────────────────────────────────────────────┐
│                   9 Production Plugins                 │
└───────────────────────────┬────────────────────────────┘
                            │ (Orchestrates Hooks & Gating)
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Centralized Event Bus                  │
└───────────────────────────┬────────────────────────────┘
                            │ (Emits JSON Observability Logs)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Skill Registry                      │
└───────────────────────────┬────────────────────────────┘
                            │ (Resolves and Invokes Utilities)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   15 Production Skills                 │
│  - Input/Output Types  - 0-100 Scoring  - Fail Fallback│
└────────────────────────────────────────────────────────┘
```

---

## 2. 15 Production Skills Specifications

---

### Skill 1: `text:flesch-readability`
*   **Description:** Measures sentence, word, and syllable counts to evaluate content accessibility.
*   **Input Shape:**
    ```typescript
    interface FleschReadabilityInput {
      text: string;
      minTargetScore?: number; // Default: 60 (Standard English)
    }
    ```
*   **Output Shape:**
    ```typescript
    interface FleschReadabilityOutput {
      fleschKincaidScore: number; // 0 - 100
      gradeLevel: string;
      wordCount: number;
      sentenceCount: number;
      syllableCount: number;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Calculates Flesch Reading Ease: `206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words))`
    *   If score >= `minTargetScore`, skill score = 100.
    *   If score < `minTargetScore`, skill score scales linearly down to 0: `Math.round((score / minTargetScore) * 100)`.
*   **Dependencies:** None (Pure local JS math/regex).
*   **Execution Priority:** Priority 1 (Linguistic gating).
*   **Hook Bindings:** `pre-publish`, `on-schedule` (via `quality-gatekeeper`).
*   **Failure Recovery Logic:** Fallback to score `50` (neutral pass), logs warnings, and outputs error logs.

---

### Skill 2: `text:ngram-similarity`
*   **Description:** Generates n-gram token sets to assess text similarity against reference drafts.
*   **Input Shape:**
    ```typescript
    interface NgramSimilarityInput {
      targetText: string;
      referenceTexts: string[];
      ngramSize?: number; // Default: 4
      maxDuplicateRatio?: number; // Default: 0.15
    }
    ```
*   **Output Shape:**
    ```typescript
    interface NgramSimilarityOutput {
      duplicateRatio: number;
      uniqueNgramCount: number;
      duplicateNgramCount: number;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Extracts n-grams for target and references.
    *   Calculates Jaccard overlap ratio.
    *   If duplicateRatio <= `maxDuplicateRatio`, score = 100.
    *   If duplicateRatio > `maxDuplicateRatio`, score degrades proportionally to 0.
*   **Dependencies:** None (Pure JS).
*   **Execution Priority:** Priority 1.
*   **Hook Bindings:** `pre-publish`, `on-schedule` (via `quality-gatekeeper`).
*   **Failure Recovery Logic:** Fallback to score `70` (warning threshold), logs warnings, and passes execution.

---

### Skill 3: `text:semantic-match`
*   **Description:** Measures keyword occurrence, density, and metadata tag distribution.
*   **Input Shape:**
    ```typescript
    interface SemanticMatchInput {
      text: string;
      keywords: string[];
      minDensity?: number; // Default: 0.01 (1%)
      maxDensity?: number; // Default: 0.04 (4%)
    }
    ```
*   **Output Shape:**
    ```typescript
    interface SemanticMatchOutput {
      keywordDensities: Record<string, number>;
      underUsedKeywords: string[];
      stuffedKeywords: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Deducts 20 points for every under-used keyword (density < `minDensity`).
    *   Deducts 20 points for every stuffed keyword (density > `maxDensity`).
    *   Clamped to [0, 100].
*   **Dependencies:** `context7` (for semantic synonyms and topic indexing).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `pre-publish`, `post-build` (via `tool-research-engine`, `seo-auditor`).
*   **Failure Recovery Logic:** Degrades gracefully to local regex word match if `context7` is offline.

---

### Skill 4: `text:eeat-credibility`
*   **Description:** Extracts author bios, citations, publish dates, and external Wikidata validation references.
*   **Input Shape:**
    ```typescript
    interface EeatCredibilityInput {
      html: string;
      metadata: Record<string, unknown>;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface EeatCredibilityOutput {
      hasAuthorBio: boolean;
      citationCount: number;
      wikidataReferences: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Author bio present: +30 points.
    *   Each reference citation: +15 points (cap at 45).
    *   Wikidata references present: +25 points.
*   **Dependencies:** None.
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `post-build`, `on-schedule` (via `aeo-auditor`).
*   **Failure Recovery Logic:** Default to score `40` (advisory warning), runs locally.

---

### Skill 5: `html:structural-validator`
*   **Description:** Audits outline structures (single H1, sequence of H2-H6) and skip-nav access.
*   **Input Shape:**
    ```typescript
    interface StructuralValidatorInput {
      html: string;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface StructuralValidatorOutput {
      h1Count: number;
      hasSkipNav: boolean;
      headingSequenceViolations: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   H1 count != 1: Deduct 40 points.
    *   No skip-nav link: Deduct 20 points.
    *   Each heading sequence violation: Deduct 15 points.
*   **Dependencies:** None.
*   **Execution Priority:** Priority 1.
*   **Hook Bindings:** `post-build`, `on-schedule` (via `seo-auditor`).
*   **Failure Recovery Logic:** Returns score `50` and logs errors to stdout.

---

### Skill 6: `html:jsonld-validator`
*   **Description:** Scrapes JSON-LD scripts, parses structure, and validates presence of required fields.
*   **Input Shape:**
    ```typescript
    interface JsonldValidatorInput {
      html: string;
      requiredSchemas: string[]; // e.g. ["Article", "BreadcrumbList"]
    }
    ```
*   **Output Shape:**
    ```typescript
    interface JsonldValidatorOutput {
      parsedSchemas: string[];
      validationErrors: Array<{ schema: string; error: string }>;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Missing required schema: Deduct 30 points per schema.
    *   Each JSON syntax error or missing recommended property: Deduct 10 points.
*   **Dependencies:** None.
*   **Execution Priority:** Priority 1.
*   **Hook Bindings:** `pre-publish`, `post-build`, `on-schedule` (via `quality-gatekeeper`, `seo-auditor`, `aeo-auditor`).
*   **Failure Recovery Logic:** Returns score `0` if JSON is completely unparseable.

---

### Skill 7: `html:link-integrity`
*   **Description:** Extracts link structures, canonical link parameters, and validates link formatting.
*   **Input Shape:**
    ```typescript
    interface LinkIntegrityInput {
      html: string;
      baseUrl: string;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface LinkIntegrityOutput {
      internalLinksCount: number;
      externalLinksCount: number;
      brokenFormats: string[];
      canonicalUrl: string | null;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Each malformed link: Deduct 15 points.
    *   Missing canonical link or non-HTTPS canonical link: Deduct 30 points.
*   **Dependencies:** None.
*   **Execution Priority:** Priority 1.
*   **Hook Bindings:** `pre-publish`, `post-build` (via `quality-gatekeeper`, `seo-auditor`).
*   **Failure Recovery Logic:** Fallback score `60` (warning), skips check if input HTML is empty.

---

### Skill 8: `html:media-accessibility`
*   **Description:** Audits image assets for alt tags, explicit sizes, and loading tags.
*   **Input Shape:**
    ```typescript
    interface MediaAccessibilityInput {
      html: string;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface MediaAccessibilityOutput {
      totalImagesCount: number;
      missingAltCount: number;
      missingDimensionsCount: number;
      missingLazyLoadCount: number;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Score = `100 - (missingAltCount * 20) - (missingDimensionsCount * 5) - (missingLazyLoadCount * 5)`. Clamped to [0, 100].
*   **Dependencies:** None.
*   **Execution Priority:** Priority 1.
*   **Hook Bindings:** `pre-publish`, `post-build` (via `quality-gatekeeper`, `seo-auditor`).
*   **Failure Recovery Logic:** Returns score `100` if no `<img>` tags are found.

---

### Skill 9: `integration:playwright-render`
*   **Description:** Launches browser automation to audit visual renders, console errors, and layout shifts.
*   **Input Shape:**
    ```typescript
    interface PlaywrightRenderInput {
      url: string;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface PlaywrightRenderOutput {
      loadDurationMs: number;
      consoleErrors: string[];
      layoutShiftScore: number;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Each console error: Deduct 15 points.
    *   Layout shift > 0.1: Deduct 25 points.
    *   Load duration > 3s: Deduct 20 points.
*   **Dependencies:** `playwright` (MCP server integration).
*   **Execution Priority:** Priority 3 (Requires external browser instance).
*   **Hook Bindings:** `pre-publish`, `post-build`, `on-schedule` (via `qa-automation`, `weekly-seo-engine`).
*   **Failure Recovery Logic:** If Playwright MCP is offline, degrades to local HTML/CSS checks and returns score `50` (degraded pass warning).

---

### Skill 10: `integration:accessibility-axe`
*   **Description:** Audits WCAG 2.1 compliance parameters (color contrast, ARIA tags, button roles).
*   **Input Shape:**
    ```typescript
    interface AccessibilityAxeInput {
      url: string;
    }
    ```
*   **Output Shape:**
    ```typescript
    interface AccessibilityAxeOutput {
      violationsCount: number;
      criticalViolations: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Each critical violation: Deduct 20 points.
    *   Each moderate violation: Deduct 10 points.
*   **Dependencies:** `playwright` (MCP server integration).
*   **Execution Priority:** Priority 3.
*   **Hook Bindings:** `pre-publish`, `post-build` (via `qa-automation`).
*   **Failure Recovery Logic:** Graceful fallback to regex check of ARIA/contrast tags, log warning, return score `70`.

---

### Skill 11: `integration:rss-feed-monitor`
*   **Description:** Scrapes Google Search updates RSS feeds to identify recent algorithm updates.
*   **Input Shape:**
    ```typescript
    interface RssFeedInput {
      feedUrl: string;
      maxAgeDays?: number; // Default: 30
    }
    ```
*   **Output Shape:**
    ```typescript
    interface RssFeedOutput {
      newUpdatesFound: boolean;
      recentUpdates: Array<{ title: string; date: string }>;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   If feed parsed successfully, score = 100.
    *   If no updates found in age bounds, score = 80.
    *   If feed unreachable, score = 0.
*   **Dependencies:** `fetch` (MCP server integration).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `on-schedule` (via `google-update-engine`, `weekly-seo-engine`).
*   **Failure Recovery Logic:** Falls back to offline database check of last logged status.

---

### Skill 12: `integration:cloudflare-check`
*   **Description:** Evaluates worker deploy limits and tests edge configuration attributes.
*   **Input Shape:**
    ```typescript
    interface CloudflareCheckInput {
      workerFilePath: string;
      maxSizeBytes?: number; // Default: 1048576 (1MB)
    }
    ```
*   **Output Shape:**
    ```typescript
    interface CloudflareCheckOutput {
      fileSizeBytes: number;
      hasEnvironmentBindings: boolean;
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   File size > `maxSizeBytes`: Deduct 50 points.
    *   Missing env bindings: Deduct 30 points.
*   **Dependencies:** `cloudflare` (MCP server integration).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `pre-publish` (via `deployment-guardian`).
*   **Failure Recovery Logic:** Runs a local disk stats check (`fs.statSync`) on the file path if Cloudflare MCP is offline.

---

### Skill 13: `integration:github-status`
*   **Description:** Monitors git statuses, branch state lockfiles, and active build validations.
*   **Input Shape:**
    ```typescript
    interface GithubStatusInput {
      repoPath: string;
      requiredActions?: string[];
    }
    ```
*   **Output Shape:**
    ```typescript
    interface GithubStatusOutput {
      isDirty: boolean;
      activeBranch: string;
      failedActions: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Uncommitted local modifications: Deduct 30 points.
    *   Failed GitHub actions/workflows: Deduct 50 points per action.
*   **Dependencies:** `github` (MCP server integration).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `pre-publish` (via `deployment-guardian`).
*   **Failure Recovery Logic:** Runs local CLI git check commands if GitHub MCP is offline.

---

### Skill 14: `db:relational-planner`
*   **Description:** Audits schemas and schema creation scripts for Postgres/SQLite.
*   **Input Shape:**
    ```typescript
    interface RelationalPlannerInput {
      schemaSql: string;
      dialect: 'sqlite' | 'postgres';
    }
    ```
*   **Output Shape:**
    ```typescript
    interface RelationalPlannerOutput {
      isValidSyntax: boolean;
      missingRelations: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Syntax error: Score = 0.
    *   Missing foreign key constraint: Deduct 20 points per instance.
*   **Dependencies:** `postgres` / `sqlite` (MCP server integrations).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `pre-publish`, `on-schedule` (via `tool-planner`, `weekly-seo-engine`).
*   **Failure Recovery Logic:** Runs checks via a local regex sql-syntax parser.

---

### Skill 15: `db:performance-index`
*   **Description:** Inspects relational tables for proper index configurations.
*   **Input Shape:**
    ```typescript
    interface PerformanceIndexInput {
      schemaSql: string;
      expectedQueries: string[];
    }
    ```
*   **Output Shape:**
    ```typescript
    interface PerformanceIndexOutput {
      unindexedQueries: string[];
      score: number; // Normalised 0-100 skill score
    }
    ```
*   **Scoring System:**
    *   Each expected query scanning unindexed tables: Deduct 25 points.
*   **Dependencies:** `sqlite` / `postgres` (MCP server integrations).
*   **Execution Priority:** Priority 2.
*   **Hook Bindings:** `pre-publish`, `on-schedule` (via `tool-planner`, `weekly-seo-engine`).
*   **Failure Recovery Logic:** Degrades gracefully to local regex matching of `CREATE INDEX` SQL strings.

---

## 3. Execution Sequencing Strategy

When a plugin executes, its checks trigger skills sequentially according to their designated **Priority (1-3)**. This ensures fast, lightweight checks run first, saving resources by early-aborting heavy checks if threshold scores become mathematically unreachable.

```
┌────────────────────────────────────────┐
│               Priority 1               │  <-- Execute first (Zero-dependency local parsing)
│   (readability, structural, jsonld)    │
└───────────────────┬────────────────────┘
                    │ (If composite score mathematically viable)
                    ▼
┌────────────────────────────────────────┐
│               Priority 2               │  <-- Execute second (Lightweight APIs and disk status)
│   (eeat, rss, github, database checks) │
└───────────────────┬────────────────────┘
                    │ (If composite score still mathematically viable)
                    ▼
┌────────────────────────────────────────┐
│               Priority 3               │  <-- Execute third (Heavy headless browser checks)
│    (playwright-render, axe audits)     │
└────────────────────────────────────────┘
```
