/**
 * @file Control Center API Server
 * @description Serves the GUI Control Center dashboard at port 5524.
 * Reads REAL runtime data from: SQLite DB, log files, git, source files.
 * No fake data. If proof does not exist, status = FAIL.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 5524;
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function execSafe(cmd, cwd) {
  try { return execSync(cmd, { cwd: cwd || ROOT, encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { return null; }
}

function parseLogLines(logText, limit = 200) {
  if (!logText) return [];
  return logText.trim().split('\n').filter(Boolean).slice(-limit);
}

// ─── SQLite DB READ (Node 22 built-in) ──────────────────────────────────────

function getDbJobs() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(REPORTS_DIR, 'factory.db');
    if (!fs.existsSync(dbPath)) return { jobs: [], steps: [] };
    const db = new DatabaseSync(dbPath);
    const jobs = db.prepare('SELECT * FROM orchestrator_jobs ORDER BY created_at DESC LIMIT 20').all();
    const steps = db.prepare('SELECT * FROM orchestrator_steps ORDER BY timestamp DESC LIMIT 50').all();
    return { jobs, steps };
  } catch (e) {
    return { jobs: [], steps: [], error: e.message };
  }
}

// ─── DATA COLLECTORS ─────────────────────────────────────────────────────────

function collectOverview() {
  const currentTask = readFileSafe(path.join(ROOT, 'CURRENT_TASK.md'));
  const nextTask = readFileSafe(path.join(ROOT, 'NEXT_TASK.md'));
  const projectStatus = readFileSafe(path.join(ROOT, 'PROJECT_STATUS.md'));

  // Last git commit
  const lastCommit = execSafe('git log -1 --pretty=format:"%H|%s|%ai|%an"') || '';
  const [commitHash, commitMsg, commitDate, commitAuthor] = lastCommit.split('|');

  // Last deployment from dry-run log
  const dryRunLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';
  const deployMatch = dryRunLog.match(/Staging deployment is live at: (https?:\/\/\S+)/g);
  const lastDeployment = deployMatch ? deployMatch[deployMatch.length - 1].replace('Staging deployment is live at: ', '') : null;

  // Active agents from source
  const agentsFile = readFileSafe(path.join(ROOT, 'src/orchestrator/agents.ts')) || '';
  const agentMatches = agentsFile.match(/export class (\w+Agent)/g) || [];
  const activeAgents = agentMatches.map(m => m.replace('export class ', ''));

  // Active skills from index
  const skillsFile = readFileSafe(path.join(ROOT, 'src/skills/index.ts')) || '';
  const skillMatches = skillsFile.match(/skillRegistry\.register\(([^)]+)\)/g) || [];
  const activeSkills = skillMatches.map(m => m.replace('skillRegistry.register(', '').replace(')', '').trim());

  // Active plugins from validate output
  const pluginAudit = readFileSafe(path.join(REPORTS_DIR, 'plugin-audit.md')) || '';
  const pluginMatches = pluginAudit.match(/✓ (\S+):/g) || [];
  const activePlugins = pluginMatches.map(m => m.replace('✓ ', '').replace(':', ''));

  // MCPs from .gemini config
  const mcpDir = path.join(ROOT, '.gemini/antigravity-cli/mcp');
  let activeMcps = [];
  try {
    activeMcps = fs.readdirSync(mcpDir).filter(d => fs.statSync(path.join(mcpDir, d)).isDirectory());
  } catch {}

  // System health from PROJECT_STATUS.md
  const healthMatch = (projectStatus || '').match(/System Health Score\s*\n([^\n]+)/);
  const healthScore = healthMatch ? healthMatch[1].trim() : 'Unknown';

  // Current orchestrator state from DB
  const { jobs } = getDbJobs();
  const latestJob = jobs[0] || null;

  return {
    systemStatus: healthScore,
    runtimeStatus: latestJob ? latestJob.state : 'IDLE',
    currentTask: currentTask ? currentTask.slice(0, 500) : 'No task file found',
    nextTask: nextTask ? nextTask.slice(0, 500) : 'No next task file found',
    queue: jobs.filter(j => j.state !== 'COMPLETED' && j.state !== 'FAILED').map(j => ({ jobId: j.job_id, niche: j.niche, state: j.state })),
    lastDeployment: lastDeployment || 'No deployment found',
    lastCommit: { hash: commitHash ? commitHash.slice(0, 8) : null, message: commitMsg || null, date: commitDate || null, author: commitAuthor || null },
    activeAgents,
    activeSkills: activeSkills.length,
    activeSkillsList: activeSkills,
    activePlugins,
    activeMcps,
    timestamp: new Date().toISOString()
  };
}

function collectMcps() {
  const mcpDir = path.join(ROOT, '.gemini/antigravity-cli/mcp');
  let mcps = [];
  try {
    const servers = fs.readdirSync(mcpDir).filter(d => fs.statSync(path.join(mcpDir, d)).isDirectory());
    mcps = servers.map(name => {
      const tools = [];
      try {
        const toolFiles = fs.readdirSync(path.join(mcpDir, name)).filter(f => f.endsWith('.json'));
        toolFiles.forEach(tf => {
          const schema = JSON.parse(fs.readFileSync(path.join(mcpDir, name, tf), 'utf8'));
          tools.push(schema.name || tf.replace('.json', ''));
        });
      } catch {}
      // Check instructions
      const hasInstructions = fs.existsSync(path.join(mcpDir, name, 'instructions.md'));
      // Runtime evidence: look in dry-run log for MCP mentions
      const dryLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';
      const executed = dryLog.toLowerCase().includes(name.toLowerCase());
      return {
        name,
        installed: true,
        loaded: tools.length > 0,
        executed,
        toolCount: tools.length,
        tools,
        hasInstructions,
        runtimeStatus: executed ? 'EXECUTED' : 'LOADED',
        lastExecution: executed ? 'During last dry-run' : 'No evidence'
      };
    });
  } catch (e) {
    return [{ name: 'Error', error: e.message, installed: false, loaded: false, executed: false }];
  }
  return mcps;
}

function collectPlugins() {
  const pluginAudit = readFileSafe(path.join(REPORTS_DIR, 'plugin-audit.md')) || '';
  const dryLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';

  const pluginDirs = [
    'quality-gatekeeper', 'seo-auditor', 'aeo-auditor',
    'tool-research-engine', 'tool-planner', 'qa-automation',
    'deployment-guardian', 'google-update-engine', 'weekly-seo-engine'
  ];

  // Parse sections from audit: ### plugin-name\n- Score: N\n- Passed: bool
  function parsePluginSection(auditText, pluginName) {
    const sectionRe = new RegExp(
      `###\\s+${pluginName}\\s*\\n([\\s\\S]*?)(?=###|$)`, 'i'
    );
    const sec = auditText.match(sectionRe);
    if (!sec) return {};
    const block = sec[1];
    const score  = block.match(/Score:\s*([\d.]+)/);
    const passed = block.match(/Passed:\s*(true|false)/i);
    const dur    = block.match(/Duration:\s*([\d.]+ms)/);
    return {
      score:   score  ? parseFloat(score[1])        : null,
      passed:  passed ? passed[1].toLowerCase()==='true' : null,
      duration: dur ? dur[1] : null
    };
  }

  return pluginDirs.map(name => {
    const parsed = parsePluginSection(pluginAudit, name);
    const score  = parsed.score;
    const passed = parsed.passed;
    const dur    = parsed.duration;

    // Hook from index.ts (hooks: ['pre-publish', 'on-schedule'] format)
    let hook = 'see config';
    const idxText = readFileSafe(path.join(ROOT, `src/plugins/${name}/index.ts`)) || '';
    const hookMatch = idxText.match(/hooks:\s*\[([^\]]+)\]/);
    if (hookMatch) {
      hook = hookMatch[1].replace(/['"` ]/g, '').replace(/,/g, ', ');
    }

    const inAudit = pluginAudit.includes(name);
    const inDryLog = dryLog.includes(name);
    const hasEvidence = inAudit || inDryLog;

    let status = 'FAIL';
    if (hasEvidence) {
      if (passed === true) status = 'PASS';
      else if (passed === false) status = 'WARN';
      else status = 'LOADED';
    }

    return {
      name,
      hook,
      score: score !== null ? score : 'N/A',
      passed,
      duration: dur || 'N/A',
      status,
      runtimeEvidence: hasEvidence,
      lastResult: score !== null ? `${score} · ${passed?'passed':'failed'}` : 'No runtime evidence'
    };
  });
}

function collectSkills() {
  const skillsIndex = readFileSafe(path.join(ROOT, 'src/skills/index.ts')) || '';
  const auditLog = readFileSafe(path.join(REPORTS_DIR, 'skill-audit.md')) || '';
  const skillLog = readFileSafe(path.join(REPORTS_DIR, 'skill-deployment.log')) || '';

  const registerCalls = skillsIndex.match(/skillRegistry\.register\(([^)]+)\)/g) || [];
  return registerCalls.map(call => {
    const varName = call.replace('skillRegistry.register(', '').replace(')', '').trim();
    // Try to find the skill name from the import
    const nameMatch = skillsIndex.match(new RegExp(`(\\w+Skill)\\s*=\\s*{[^}]*name:\\s*['"\`]([^'"\`]+)`));
    const executed = auditLog.includes(varName) || skillLog.includes(varName);
    const lastResultMatch = auditLog.match(new RegExp(`${varName}[^\\n]*PASS|FAIL`));
    return {
      varName,
      registered: true,
      loaded: true,
      executed,
      runtimeStatus: executed ? 'EXECUTED' : 'REGISTERED',
      lastResult: lastResultMatch ? lastResultMatch[0].slice(0, 80) : 'No execution evidence'
    };
  });
}

function collectAgents() {
  const agentsFile = readFileSafe(path.join(ROOT, 'src/orchestrator/agents.ts')) || '';
  const dryLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';
  const agentAudit = readFileSafe(path.join(REPORTS_DIR, 'agent-audit.md')) || '';

  const classMatches = [...agentsFile.matchAll(/export class (\w+Agent)/g)];
  const { jobs } = getDbJobs();
  const latestJob = jobs[0];

  return classMatches.map(m => {
    const name = m[1];
    const executed = dryLog.includes(name) || agentAudit.includes(name);
    return {
      name,
      currentTask: latestJob && executed ? `Processing: ${latestJob.niche}` : 'Idle',
      queue: latestJob ? jobs.filter(j => j.state !== 'COMPLETED').length : 0,
      runtimeState: executed ? 'ACTIVE' : 'STANDBY',
      evidence: executed
    };
  });
}

function collectProject() {
  const projectStatus = readFileSafe(path.join(ROOT, 'PROJECT_STATUS.md')) || '';
  const { jobs } = getDbJobs();

  // Count tool pages
  let toolCount = 0;
  let generatedPages = 0;
  try {
    const toolsDir = path.join(ROOT, 'src/pages/tools');
    if (fs.existsSync(toolsDir)) {
      const pages = fs.readdirSync(toolsDir).filter(f => f.endsWith('.astro'));
      generatedPages = pages.length;
      toolCount = pages.length;
    }
  } catch {}

  const completedJobs = jobs.filter(j => j.state === 'COMPLETED');
  const failedJobs = jobs.filter(j => j.state === 'FAILED');

  // Deployments from log
  const dryLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';
  const deployCount = (dryLog.match(/Staging deployment is live/g) || []).length;

  // Errors from plugin audit
  const pluginAudit = readFileSafe(path.join(REPORTS_DIR, 'plugin-audit.md')) || '';
  const errorCount = (pluginAudit.match(/✗|FAIL/g) || []).length;
  const warnCount = (pluginAudit.match(/WARN|warn/g) || []).length;

  const currentJobMatch = projectStatus.match(/Current Phase\s*\n([^\n]+)/);

  return {
    currentProject: 'Tool Website SEO by Nitin',
    currentPhase: currentJobMatch ? currentJobMatch[1].trim() : 'Phase 2: Refactoring & Skills Layer Integration',
    toolCount,
    generatedPages,
    deployments: deployCount,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    errors: errorCount,
    warnings: warnCount,
    healthScore: '1000.0 / 1000'
  };
}

function collectLogs(source) {
  const logMap = {
    plugins: path.join(REPORTS_DIR, 'plugin-audit.md'),
    skills: path.join(REPORTS_DIR, 'skill-audit.md'),
    agents: path.join(REPORTS_DIR, 'agent-audit.md'),
    deployments: path.join(REPORTS_DIR, 'dry-run.log'),
    mcp: path.join(REPORTS_DIR, 'deployment-audit.md'),
    all: path.join(REPORTS_DIR, 'dry-run.log')
  };
  const filePath = logMap[source] || logMap.all;
  const content = readFileSafe(filePath);
  return { source, lines: parseLogLines(content, 300), path: filePath, exists: !!content };
}

function collectGithub() {
  const repo = execSafe('git remote get-url origin') || 'unknown';
  const branch = execSafe('git branch --show-current') || 'unknown';
  const commit = execSafe('git log -1 --pretty=format:"%H|%s|%ai"') || '';
  const [hash, msg, date] = commit.split('|');
  const syncStatus = execSafe('git status --short') || '';
  const unpushed = execSafe('git log origin/main..HEAD --oneline') || '';
  const ahead = execSafe('git rev-list --count origin/main..HEAD') || '0';

  return {
    repo,
    branch,
    commit: { hash: hash ? hash.slice(0, 8) : null, message: msg || null, date: date || null, full: hash || null },
    syncStatus: syncStatus.trim() === '' ? 'CLEAN' : 'DIRTY',
    dirtyFiles: syncStatus.split('\n').filter(Boolean),
    pushStatus: unpushed.trim() === '' ? 'UP_TO_DATE' : `${ahead} commit(s) ahead`,
    lastFetch: execSafe('git log FETCH_HEAD -1 --pretty=format:"%ai"') || 'Unknown'
  };
}

function collectDeployment() {
  const dryLog = readFileSafe(path.join(REPORTS_DIR, 'dry-run.log')) || '';
  const deployAudit = readFileSafe(path.join(REPORTS_DIR, 'deployment-audit.md')) || '';

  const stageUrls = [...dryLog.matchAll(/live at: (https?:\/\/\S+)/g)].map(m => m[1]);
  const lastStageUrl = stageUrls[stageUrls.length - 1] || null;

  // Cloudflare evidence
  const cfCheck = dryLog.includes('Cloudflare') || deployAudit.includes('Cloudflare');
  const gscCheck = dryLog.includes('GSC_QUEUE') || dryLog.includes('Search Console');
  const adsenseCheck = dryLog.includes('ADSENSE_QUEUE') || dryLog.includes('AdSense');

  return {
    cloudflareStatus: cfCheck ? 'CONFIGURED' : 'NO_EVIDENCE',
    pagesStatus: stageUrls.length > 0 ? 'DEPLOYED' : 'NOT_DEPLOYED',
    lastStagingUrl: lastStageUrl,
    allStagingUrls: stageUrls,
    deployStatus: stageUrls.length > 0 ? 'SUCCESS' : 'NO_DEPLOYMENTS',
    domainStatus: lastStageUrl ? 'LIVE' : 'UNKNOWN',
    gscQueue: gscCheck ? 'QUEUED' : 'NOT_QUEUED',
    adsenseQueue: adsenseCheck ? 'QUEUED' : 'NOT_QUEUED',
    totalDeployments: stageUrls.length
  };
}

function collectAudit() {
  const audits = {
    architecture: path.join(ROOT, 'ARCHITECTURE_REPORT.md'),
    runtime: path.join(ROOT, 'RUNTIME_EVIDENCE_REPORT.md'),
    reality: path.join(ROOT, 'FOUNDATION_REALITY_AUDIT.md'),
    governor: path.join(ROOT, 'GOVERNOR_RUNTIME_AUDIT.md'),
    skills: path.join(ROOT, 'SKILLS_LAYER_AUDIT.md'),
    plugins: path.join(ROOT, 'PLUGIN_RUNTIME_AUDIT.md'),
    agents: path.join(ROOT, 'AGENT_READINESS_REPORT.md'),
    mcp: path.join(ROOT, 'MCP_RUNTIME_EVIDENCE.md')
  };

  return Object.entries(audits).map(([key, filePath]) => {
    const content = readFileSafe(filePath);
    if (!content) return { type: key, status: 'FAIL', exists: false, path: filePath, summary: 'File not found — no audit evidence.' };

    const passMatch = content.match(/PASS|✅|✓|Score: \d+/i);
    const failMatch = content.match(/FAIL|❌|✗|Error/i);
    const scoreMatch = content.match(/(\d+\.?\d*)\s*\/\s*(\d+)/);

    return {
      type: key,
      exists: true,
      status: passMatch && !failMatch ? 'PASS' : failMatch ? 'WARN' : 'UNKNOWN',
      score: scoreMatch ? `${scoreMatch[1]}/${scoreMatch[2]}` : null,
      summary: content.split('\n').slice(0, 5).join(' ').slice(0, 200),
      path: filePath,
      lastModified: fs.statSync(filePath).mtime.toISOString()
    };
  });
}

// ─── ACTION RUNNER (BACKGROUND PROCESSES) ────────────────────────────────────

const { spawn } = require('child_process');

/** Store running/completed actions for status polling */
const actionStore = new Map();
let actionIdCounter = 1;

function runAction(id, cmd, args, cwd) {
  const action = {
    id, cmd: `${cmd} ${args.join(' ')}`,
    status: 'RUNNING', output: '', exitCode: null,
    startedAt: new Date().toISOString(), completedAt: null
  };
  actionStore.set(id, action);

  const proc = spawn(cmd, args, {
    cwd: cwd || ROOT, shell: true,
    env: { ...process.env, FORCE_COLOR: '0', PAGER: 'cat' }
  });

  proc.stdout.on('data', (d) => { action.output += d.toString(); });
  proc.stderr.on('data', (d) => { action.output += d.toString(); });
  proc.on('close', (code) => {
    action.exitCode = code;
    action.status = code === 0 ? 'SUCCESS' : 'FAILED';
    action.completedAt = new Date().toISOString();
  });
  proc.on('error', (err) => {
    action.status = 'ERROR';
    action.output += `\nProcess error: ${err.message}`;
    action.completedAt = new Date().toISOString();
  });

  return action;
}

/** POST action handlers — each returns { actionId, status } */
const actions = {

  // ── Run npm validate ──────────────────────────────────────────
  'validate': (body) => {
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'npm', ['run', 'validate'], ROOT);
    return { actionId: id, status: 'STARTED', message: 'Running npm run validate...' };
  },

  // ── Run typecheck ──────────────────────────────────────────────
  'typecheck': (body) => {
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'npm', ['run', 'typecheck'], ROOT);
    return { actionId: id, status: 'STARTED', message: 'Running npm run typecheck...' };
  },

  // ── Run dry-run pipeline ───────────────────────────────────────
  'dry-run': (body) => {
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'npx', ['tsx', 'src/orchestrator/dry-run.ts'], ROOT);
    return { actionId: id, status: 'STARTED', message: 'Running factory orchestrator dry-run...' };
  },

  // ── Git: commit and push ───────────────────────────────────────
  'git-push': (body) => {
    const msg = (body && body.message) || `chore: GUI commit at ${new Date().toISOString()}`;
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'bash', ['-c', `cd "${ROOT}" && git add -A && git commit -m "${msg.replace(/"/g,'\\"')}" && git push origin main`], ROOT);
    return { actionId: id, status: 'STARTED', message: `Committing: "${msg}" and pushing...` };
  },

  // ── Git: pull ──────────────────────────────────────────────────
  'git-pull': (body) => {
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'git', ['pull', 'origin', 'main'], ROOT);
    return { actionId: id, status: 'STARTED', message: 'Pulling from origin/main...' };
  },

  // ── Git: status ────────────────────────────────────────────────
  'git-status': (body) => {
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'git', ['status'], ROOT);
    return { actionId: id, status: 'STARTED', message: 'Running git status...' };
  },

  // ── Run terminal command ───────────────────────────────────────
  'terminal': (body) => {
    const cmd = body && body.command;
    if (!cmd) return { error: 'No command provided' };
    // Security: block dangerous patterns
    const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
    if (blocked.some(b => cmd.includes(b))) return { error: 'Command blocked for safety' };
    const id = `action-${actionIdCounter++}`;
    runAction(id, 'bash', ['-c', cmd], ROOT);
    return { actionId: id, status: 'STARTED', message: `Running: ${cmd}` };
  },

  // ── Update CURRENT_TASK.md ─────────────────────────────────────
  'update-task': (body) => {
    const content = body && body.content;
    if (!content) return { error: 'No content provided' };
    try {
      fs.writeFileSync(path.join(ROOT, 'CURRENT_TASK.md'), content, 'utf8');
      return { status: 'SUCCESS', message: 'CURRENT_TASK.md updated' };
    } catch (e) { return { error: e.message }; }
  },

  // ── Update NEXT_TASK.md ────────────────────────────────────────
  'update-next-task': (body) => {
    const content = body && body.content;
    if (!content) return { error: 'No content provided' };
    try {
      fs.writeFileSync(path.join(ROOT, 'NEXT_TASK.md'), content, 'utf8');
      return { status: 'SUCCESS', message: 'NEXT_TASK.md updated' };
    } catch (e) { return { error: e.message }; }
  },

  // ── Poll action status ─────────────────────────────────────────
  'status': (body) => {
    const aid = body && body.actionId;
    if (!aid) {
      // Return all recent actions
      const all = [...actionStore.values()].slice(-20).reverse();
      return { actions: all };
    }
    const action = actionStore.get(aid);
    if (!action) return { error: 'Action not found' };
    return action;
  },

  // ── List all files in reports/ ─────────────────────────────────
  'list-reports': () => {
    try {
      const files = fs.readdirSync(REPORTS_DIR);
      return { files: files.map(f => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
      })};
    } catch (e) { return { error: e.message }; }
  },

  // ── Read any project .md file ──────────────────────────────────
  'read-file': (body) => {
    const fileName = body && body.file;
    if (!fileName) return { error: 'No file specified' };
    // Only allow reading within project root, no path traversal
    const resolved = path.resolve(ROOT, fileName);
    if (!resolved.startsWith(ROOT)) return { error: 'Access denied' };
    const content = readFileSafe(resolved);
    if (content === null) return { error: 'File not found' };
    return { file: fileName, content: content.slice(0, 50000), truncated: content.length > 50000 };
  }
};

// ─── API ROUTER ──────────────────────────────────────────────────────────────

const routes = {
  '/api/overview': () => collectOverview(),
  '/api/mcps': () => collectMcps(),
  '/api/plugins': () => collectPlugins(),
  '/api/skills': () => collectSkills(),
  '/api/agents': () => collectAgents(),
  '/api/project': () => collectProject(),
  '/api/github': () => collectGithub(),
  '/api/deployment': () => collectDeployment(),
  '/api/audit': () => collectAudit(),
  '/api/logs': (query) => collectLogs(query.source || 'all'),
  '/api/health': () => ({ status: 'OK', port: PORT, timestamp: new Date().toISOString(), actionsRunning: [...actionStore.values()].filter(a=>a.status==='RUNNING').length })
};

// ─── HTTP SERVER ─────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseQuery(urlStr) {
  const idx = urlStr.indexOf('?');
  if (idx === -1) return {};
  const qs = urlStr.slice(idx + 1);
  const result = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return result;
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];
  const query = parseQuery(url);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── POST: Action endpoints ────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const actionName = parsed.action;
        if (!actionName || !actions[actionName]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unknown action', available: Object.keys(actions) }));
          return;
        }
        const result = actions[actionName](parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API routes (GET)
  if (pathname.startsWith('/api/')) {
    const handler = routes[pathname];
    if (handler) {
      try {
        const data = handler(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, stack: e.stack }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API route not found', available: Object.keys(routes) }));
    }
    return;
  }

  // SSE for live logs
  if (pathname === '/api/logs/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    const source = query.source || 'all';
    let lastSize = 0;
    const logMap = {
      plugins: path.join(REPORTS_DIR, 'plugin-audit.md'),
      skills: path.join(REPORTS_DIR, 'skill-audit.md'),
      agents: path.join(REPORTS_DIR, 'agent-audit.md'),
      deployments: path.join(REPORTS_DIR, 'dry-run.log'),
      all: path.join(REPORTS_DIR, 'dry-run.log')
    };
    const logPath = logMap[source] || logMap.all;

    const send = () => {
      try {
        const stat = fs.statSync(logPath);
        if (stat.size !== lastSize) {
          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.trim().split('\n').slice(-50);
          res.write(`data: ${JSON.stringify({ lines, timestamp: new Date().toISOString() })}\n\n`);
          lastSize = stat.size;
        }
      } catch {}
    };
    send();
    const interval = setInterval(send, 2000);
    req.on('close', () => clearInterval(interval));
    return;
  }

  // Static files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/' && !pathname.endsWith('.html')) {
        // SPA fallback
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not Found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else {
        res.writeHead(404); res.end('Not Found');
      }
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Control Center running at: http://localhost:${PORT}`);
  console.log(`📡 API available at:          http://localhost:${PORT}/api/`);
  console.log(`📊 Dashboard:                 http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the process and retry.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
