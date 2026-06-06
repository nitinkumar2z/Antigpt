#!/usr/bin/env node
/**
 * @file scripts/scan-skills.cjs
 * @description Source scanner that detects SkillDefinition objects in src/skills/**
 *
 * Parses TypeScript source files using regex-based static analysis to extract:
 *   - Skill runtime name (from `name: '...'` inside SkillDefinition)
 *   - Description string
 *   - Export variable name
 *   - Source file path
 *   - Line number
 *
 * Outputs a JSON array of discovered skills.
 *
 * Usage:
 *   node scripts/scan-skills.cjs             # print discovered skills as JSON
 *   node scripts/scan-skills.cjs --summary   # print a human-readable table
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const args       = process.argv.slice(2);
const SUMMARY    = args.includes('--summary') || args.includes('-s');
const DIFF_MODE  = args.includes('--diff');   // compare discovered vs catalogue

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SKILLS_SRC   = path.join(PROJECT_ROOT, 'src', 'skills');

// ─── Colour helpers ───────────────────────────────────────────────────────────
const C = {
  reset : '\x1b[0m', bold: '\x1b[1m',
  green : '\x1b[32m', yellow: '\x1b[33m',
  cyan  : '\x1b[36m', red: '\x1b[31m', grey: '\x1b[90m',
};

// ─── Gather all .ts skill source files ───────────────────────────────────────
function walkDir(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'types.ts') {
      results.push(full);
    }
  }
  return results;
}

// ─── Parse a single file for SkillDefinition exports ─────────────────────────
/**
 * Regex strategy:
 *   1. Find `SkillDefinition<...>` assignments/const declarations.
 *   2. From within the surrounding block, extract `name: '...'` and `description: '...'`.
 *   3. Walk the block to get the const/export variable name and line number.
 */
function parseSkillFile(filePath) {
  const src     = fs.readFileSync(filePath, 'utf8');
  const lines   = src.split('\n');
  const relPath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  const results = [];

  // Match export const <name>: SkillDefinition<...> = {
  const SKILL_DECL = /export\s+const\s+(\w+)\s*:\s*SkillDefinition\s*<[^>]*>\s*=\s*\{/g;

  let match;
  while ((match = SKILL_DECL.exec(src)) !== null) {
    const exportName = match[1];
    const blockStart = match.index + match[0].length - 1; // position of opening {

    // Find the matching closing }
    let depth    = 1;
    let pos      = blockStart + 1;
    const srcLen = src.length;

    while (pos < srcLen && depth > 0) {
      if (src[pos] === '{') depth++;
      else if (src[pos] === '}') depth--;
      pos++;
    }

    const block = src.slice(blockStart, pos);

    // Extract name field
    const nameMatch = /name\s*:\s*['"`]([^'"`]+)['"`]/.exec(block);
    // Extract description field
    const descMatch = /description\s*:\s*['"`]([^'"`]+)['"`]/.exec(block);

    if (!nameMatch) continue; // not a proper SkillDefinition

    // Compute line number of the export const declaration
    const linesBefore = src.slice(0, match.index).split('\n');
    const lineNumber  = linesBefore.length;

    results.push({
      exportName,
      runtimeName : nameMatch[1],
      description : descMatch ? descMatch[1] : '(no description)',
      sourceFile  : relPath,
      line        : lineNumber,
    });
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const tsFiles   = walkDir(SKILLS_SRC);
  const allSkills = [];

  for (const file of tsFiles) {
    const found = parseSkillFile(file);
    allSkills.push(...found);
  }

  // Sort by source file then runtime name
  allSkills.sort((a, b) =>
    a.sourceFile.localeCompare(b.sourceFile) || a.runtimeName.localeCompare(b.runtimeName)
  );

  if (SUMMARY) {
    console.log(`\n${C.bold}Discovered Skills (${allSkills.length})${C.reset}\n`);
    console.log(`  ${'Runtime Name'.padEnd(40)} ${'Export'.padEnd(35)} ${'File'.padEnd(45)} Line`);
    console.log('  ' + '─'.repeat(130));
    for (const s of allSkills) {
      const line = `  ${s.runtimeName.padEnd(40)} ${s.exportName.padEnd(35)} ${s.sourceFile.padEnd(45)} ${s.line}`;
      console.log(line);
    }
    console.log();
  } else if (DIFF_MODE) {
    // Load deploy-skills catalogue and compare
    try {
      const deployScript = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'deploy-skills.cjs'), 'utf8');
      const catalogueMatch = /const SKILL_CATALOGUE\s*=\s*(\[[\s\S]*?\n\];)/m.exec(deployScript);

      console.log(`\nScanned:   ${allSkills.length} skills in source`);
      const scannedNames = allSkills.map(s => s.runtimeName).sort();
      console.log('\nRuntime Names Found in Source:');
      for (const n of scannedNames) {
        console.log(`  ${C.green}✔${C.reset}  ${n}`);
      }
    } catch (e) {
      console.error('Could not load deploy-skills.cjs for diff:', e.message);
    }
  } else {
    // JSON output (machine-readable, for use by other tools)
    console.log(JSON.stringify(allSkills, null, 2));
  }
}

main();
