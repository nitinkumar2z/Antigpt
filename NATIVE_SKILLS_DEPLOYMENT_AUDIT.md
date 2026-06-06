# Native Skills Deployment Audit

## Runtime Skills (15 verified from source)

| # | Runtime Name                      | Source File                                  | Line |
|---|-----------------------------------|----------------------------------------------|------|
| 1 | `text:flesch-readability`         | src/skills/text/readability.ts               | L45  |
| 2 | `text:ngram-similarity`           | src/skills/text/n-gram.ts                    | L42  |
| 3 | `text:semantic-match`             | src/skills/text/semantic.ts                  | L22  |
| 4 | `text:eeat-credibility`           | src/skills/text/eeat.ts                      | L20  |
| 5 | `html:structural-validator`       | src/skills/html/structural.ts                | L19  |
| 6 | `html:jsonld-validator`           | src/skills/html/jsonld.ts                    | L19  |
| 7 | `html:link-integrity`             | src/skills/html/links.ts                     | L21  |
| 8 | `html:media-accessibility`        | src/skills/html/media.ts                     | L20  |
| 9 | `integration:playwright-render`   | src/skills/integration/playwright.ts         | L21  |
|10 | `integration:accessibility-axe`   | src/skills/integration/playwright.ts         | L68  |
|11 | `integration:rss-feed-monitor`    | src/skills/integration/network.ts            | L19  |
|12 | `integration:cloudflare-check`    | src/skills/integration/cloudflare.ts         | L20  |
|13 | `integration:github-status`       | src/skills/integration/github.ts             | L24  |
|14 | `db:relational-planner`           | src/skills/db/relational.ts                  | L19  |
|15 | `db:performance-index`            | src/skills/db/performance.ts                 | L18  |

## Deployment Folder Cross-Reference (15/15 matched)

| Runtime ID                         | ~/.gemini/skills/ Folder     | metadata.json | SKILL.md | examples.md | registered |
|------------------------------------|------------------------------|:---:|:---:|:---:|:---:|
| text:flesch-readability            | flesch-readability           | ✅ | ✅ | ✅ | true |
| text:ngram-similarity              | ngram-similarity             | ✅ | ✅ | ✅ | true |
| text:semantic-match                | semantic-match               | ✅ | ✅ | ✅ | true |
| text:eeat-credibility              | eeat-credibility             | ✅ | ✅ | ✅ | true |
| html:structural-validator          | structural-validator         | ✅ | ✅ | ✅ | true |
| html:jsonld-validator              | jsonld-validator             | ✅ | ✅ | ✅ | true |
| html:link-integrity                | link-integrity               | ✅ | ✅ | ✅ | true |
| html:media-accessibility           | media-accessibility          | ✅ | ✅ | ✅ | true |
| integration:playwright-render      | playwright-render            | ✅ | ✅ | ✅ | true |
| integration:accessibility-axe      | accessibility-axe            | ✅ | ✅ | ✅ | true |
| integration:rss-feed-monitor       | rss-feed-monitor             | ✅ | ✅ | ✅ | true |
| integration:cloudflare-check       | cloudflare-check             | ✅ | ✅ | ✅ | true |
| integration:github-status          | github-status                | ✅ | ✅ | ✅ | true |
| db:relational-planner              | relational-planner           | ✅ | ✅ | ✅ | true |
| db:performance-index               | performance-index            | ✅ | ✅ | ✅ | true |

## Deployment Mechanism Check

No automated deploy script exists in `package.json` or `src/`.
No code in `src/` references `~/.gemini/skills` at runtime.
Deployment was performed manually by writing manifest files directly to `~/.gemini/skills/`.

## UI Discovery Check

UI reads `~/.gemini/skills/<folder>/metadata.json` at startup.
All 15 native skill folders contain valid `metadata.json` with `"registered": true`.
UI can enumerate all 25 skills (10 Application + 15 Native) on next load.

---

Runtime Skills:
15

Deployed Skills:
15

Missing Deployments:
NONE

Deployment Mechanism Exists:
NO (manual file writes performed — no automated sync script exists in codebase)

UI Discoverable After Deployment:
YES (all 15 folders contain valid metadata.json with registered: true)

PASS/FAIL:
PASS
