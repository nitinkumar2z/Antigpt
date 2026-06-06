Native Skills Location:
/root/src/skills

UI Skills Count:
0

Runtime Skills Count:
15

Reason For Difference:
Runtime execution relies on static TypeScript module registration (`src/skills/index.ts`) internal to the application codebase. The UI visibility system is completely disconnected and dynamically reads from the `~/.gemini/skills` directory. The 15 native skills are built as local TypeScript libraries but were never deployed to the `~/.gemini/skills` folder where the UI expects to find them (which currently only contains the 10 Application Skills).

PASS/FAIL:
FAIL
