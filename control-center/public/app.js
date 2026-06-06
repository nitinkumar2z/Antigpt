/* ═══════════════════════════════════════════════════════════════════════════
   ANTIGRAVITY CONTROL CENTER — App Logic
   All data is fetched from /api/* endpoints (real runtime data only)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentPage = 'overview';
let refreshTimer = null;
let refreshMs = 10000;
let logSource = 'all';
let logLines = [];
let logEventSource = null;
let sidebarOpen = window.innerWidth > 900;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  if (!sidebarOpen) document.querySelector('.sidebar').classList.add('collapsed');
  loadPage('overview');
  startAutoRefresh();
  checkApiHealth();
});

// ─── CLOCK ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const el = document.getElementById('topbar-clock');
  if (el) el.textContent = `${h}:${m}:${s}`;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function navigate(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');
  currentPage = page;
  const labels = {
    overview:'Overview', mcp:'MCP Dashboard', plugins:'Plugin Dashboard',
    skills:'Skills Dashboard', agents:'Agent Dashboard', project:'Project Dashboard',
    logs:'Logs Viewer', github:'GitHub Dashboard', deployment:'Deployment Dashboard',
    audit:'Audit Dashboard', terminal:'Terminal', actions:'Actions Center'
  };
  document.getElementById('current-page-label').textContent = labels[page] || page;
  loadPage(page);
  return false;
}

function loadPage(page) {
  const loaders = {
    overview:   loadOverview,
    mcp:        loadMcp,
    plugins:    loadPlugins,
    skills:     loadSkills,
    agents:     loadAgents,
    project:    loadProject,
    logs:       loadLogs,
    github:     loadGithub,
    deployment: loadDeployment,
    audit:      loadAudit,
    terminal:   loadTerminal,
    actions:    loadActions
  };
  if (loaders[page]) loaders[page]();
}

function refreshCurrent() { loadPage(currentPage); }

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (refreshMs > 0) refreshTimer = setInterval(() => loadPage(currentPage), refreshMs);
}

function setRefreshInterval(val) {
  refreshMs = parseInt(val);
  startAutoRefresh();
}

function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const mc = document.querySelector('.main-content');
  sb.classList.toggle('collapsed');
  mc.classList.toggle('expanded');
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkApiHealth() {
  const liveEl = document.getElementById('live-status');
  const dotEl = document.querySelector('.pulse-dot');
  try {
    await api('/api/health');
    liveEl.textContent = 'Connected';
    dotEl.classList.remove('error');
  } catch {
    liveEl.textContent = 'Disconnected';
    dotEl.classList.add('error');
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function badge(status) {
  const map = { PASS:'pass', FAIL:'fail', WARN:'warn', OK:'pass', ERROR:'fail',
    ACTIVE:'pass', STANDBY:'muted', EXECUTED:'pass', LOADED:'info', REGISTERED:'accent',
    CLEAN:'pass', DIRTY:'warn', UP_TO_DATE:'pass', DEPLOYED:'pass', NOT_DEPLOYED:'fail',
    SUCCESS:'pass', CONFIGURED:'pass', NO_EVIDENCE:'fail', IDLE:'muted', COMPLETED:'pass',
    UNKNOWN:'muted', LIVE:'pass', QUEUED:'info' };
  const cls = map[status] || 'muted';
  return `<span class="badge badge-${cls}">${status}</span>`;
}

function scoreColor(s) {
  if (s >= 90) return 'green';
  if (s >= 70) return 'accent';
  if (s >= 50) return 'amber';
  return 'red';
}

function scoreRing(score, max=100) {
  const pct = Math.min(100, Math.max(0, (score/max)*100));
  const r = 26, circ = 2*Math.PI*r;
  const offset = circ - (pct/100)*circ;
  const col = score>=90?'#10b981':score>=70?'#6366f1':score>=50?'#f59e0b':'#ef4444';
  return `<div class="score-ring">
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle class="score-ring-bg" cx="32" cy="32" r="${r}"/>
      <circle class="score-ring-val" cx="32" cy="32" r="${r}"
        stroke="${col}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
    </svg>
    <div class="score-ring-text" style="color:${col}">${Math.round(score)}</div>
  </div>`;
}

function el(id) { return document.getElementById(id); }
function set(id, html) { const e = el(id); if (e) e.innerHTML = html; }

function progressBar(val, max=100, cls='') {
  const pct = Math.min(100, Math.max(0, (val/max)*100));
  const c = val>=90?'green':val>=70?'':val>=50?'amber':'red';
  return `<div class="progress-bar"><div class="progress-fill ${c} ${cls}" style="width:${pct}%"></div></div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── PAGE: OVERVIEW ───────────────────────────────────────────────────────────
async function loadOverview() {
  set('overview-skeleton', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/overview');
    let html = '';

    // Hero
    html += `<div class="overview-hero">
      <div class="hero-left">
        <h2>Tool Website SEO by Nitin</h2>
        <p>Antigravity Autonomous SEO Factory · Port 5524 · Real Data Only</p>
      </div>
      <div class="hero-score">
        <div class="hero-score-label">System Health</div>
        <div class="hero-score-value">${escHtml(d.systemStatus || '---')}</div>
      </div>
    </div>`;

    // Quick Action Buttons
    html += `<div class="overview-actions">
      <button class="btn-action" onclick="fireAction('validate')">▶ Run Validation</button>
      <button class="btn-action" onclick="fireAction('typecheck')">▶ TypeCheck</button>
      <button class="btn-action" onclick="fireAction('dry-run')">▶ Dry Run</button>
      <button class="btn-action" onclick="showGitCommitModal()">⤴ Git Commit & Push</button>
      <button class="btn-secondary" onclick="navigate('terminal',document.querySelector('[data-page=terminal]'))">⌘ Terminal</button>
    </div>`;

    // Stat cards row 1
    html += `<div class="card-grid">
      <div class="card card-accent">
        <div class="card-label">Runtime Status</div>
        <div class="card-value sm">${badge(d.runtimeStatus || 'UNKNOWN')}</div>
        <div class="card-meta">Orchestrator engine state</div>
      </div>
      <div class="card">
        <div class="card-label">Last Deployment</div>
        <div class="card-value sm" style="font-size:12px;word-break:break-all">${escHtml(d.lastDeployment || 'None')}</div>
        <div class="card-meta">Cloudflare Pages staging</div>
      </div>
      <div class="card">
        <div class="card-label">Last Commit</div>
        <div class="card-value mono">${d.lastCommit?.hash ? escHtml(d.lastCommit.hash) : 'N/A'}</div>
        <div class="card-meta">${d.lastCommit?.message ? escHtml(d.lastCommit.message.slice(0,60)) : 'No commit found'}</div>
      </div>
      <div class="card">
        <div class="card-label">Queue Jobs</div>
        <div class="card-value">${d.queue?.length ?? 0}</div>
        <div class="card-meta">Pending orchestrator jobs</div>
      </div>
    </div>`;

    // Agents / Skills / Plugins / MCPs
    html += `<div class="card-grid">
      <div class="card">
        <div class="card-label">Active Agents</div>
        <div class="card-value">${d.activeAgents?.length ?? 0}</div>
        <div class="chip-list">${(d.activeAgents||[]).map(a=>`<span class="chip">${escHtml(a)}</span>`).join('')}</div>
      </div>
      <div class="card">
        <div class="card-label">Active Skills</div>
        <div class="card-value">${d.activeSkills ?? 0}</div>
        <div class="card-meta">${d.activeSkillsList?.length || 0} registered in skill registry</div>
      </div>
      <div class="card">
        <div class="card-label">Active Plugins</div>
        <div class="card-value">${d.activePlugins?.length ?? 0}</div>
        <div class="chip-list">${(d.activePlugins||[]).slice(0,4).map(p=>`<span class="chip">${escHtml(p)}</span>`).join('')}</div>
      </div>
      <div class="card">
        <div class="card-label">Active MCPs</div>
        <div class="card-value">${d.activeMcps?.length ?? 0}</div>
        <div class="chip-list">${(d.activeMcps||[]).map(m=>`<span class="chip">${escHtml(m)}</span>`).join('')}</div>
      </div>
    </div>`;

    // Current Task
    html += `<div class="section-title">Current Task</div>
    <div class="task-block">
      <pre>${escHtml(d.currentTask||'No task file found')}</pre>
    </div>`;

    // Next Task
    html += `<div class="section-title">Next Task</div>
    <div class="task-block">
      <pre>${escHtml(d.nextTask||'No next task file found')}</pre>
    </div>`;

    // Queue
    if (d.queue?.length > 0) {
      html += `<div class="section-title">Job Queue (${d.queue.length})</div>
      <div class="table-container"><table class="data-table">
        <thead><tr><th>Job ID</th><th>Niche</th><th>State</th></tr></thead>
        <tbody>${d.queue.map(j=>`<tr>
          <td class="mono">${escHtml(j.jobId)}</td>
          <td>${escHtml(j.niche)}</td>
          <td>${badge(j.state)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }

    set('overview-content', html);
  } catch (e) {
    set('overview-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: MCP ────────────────────────────────────────────────────────────────
async function loadMcp() {
  set('mcp-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/mcps');
    let html = `<div class="table-container">
      <div class="table-header">
        <span class="table-title">MCP Servers</span>
        <span class="table-count">${d.length} servers</span>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Server Name</th><th>Installed</th><th>Loaded</th><th>Executed</th>
          <th>Tools</th><th>Runtime Status</th><th>Last Execution</th>
        </tr></thead>
        <tbody>${d.map(m => `<tr>
          <td style="font-weight:600;color:var(--text-primary)">${escHtml(m.name)}</td>
          <td>${badge(m.installed ? 'PASS' : 'FAIL')}</td>
          <td>${badge(m.loaded ? 'PASS' : 'FAIL')}</td>
          <td>${badge(m.executed ? 'PASS' : 'FAIL')}</td>
          <td><span class="badge badge-info">${m.toolCount || 0}</span></td>
          <td>${badge(m.runtimeStatus || 'UNKNOWN')}</td>
          <td style="font-size:11px;color:var(--text-muted)">${escHtml(m.lastExecution || 'N/A')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

    // Tool detail cards
    html += `<div class="section-title">MCP Tool Details</div>
    <div class="card-grid card-grid-3">`;
    d.forEach(m => {
      html += `<div class="card">
        <div class="card-label">${escHtml(m.name)}</div>
        <div style="margin-bottom:10px">${badge(m.runtimeStatus || 'UNKNOWN')}</div>
        <div class="chip-list">${(m.tools||[]).slice(0,8).map(t=>`<span class="chip">${escHtml(t)}</span>`).join('')}</div>
        <div class="card-meta">${m.toolCount} tools · ${m.hasInstructions?'Has instructions':'No instructions'}</div>
      </div>`;
    });
    html += `</div>`;
    set('mcp-content', html);
  } catch(e) {
    set('mcp-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: PLUGINS ────────────────────────────────────────────────────────────
async function loadPlugins() {
  set('plugins-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/plugins');
    let passCount = d.filter(p=>p.status==='PASS').length;
    let html = `<div class="card-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
      <div class="card card-accent">
        <div class="card-label">Total Plugins</div>
        <div class="card-value">${d.length}</div>
      </div>
      <div class="card">
        <div class="card-label">Passing</div>
        <div class="card-value" style="color:var(--green)">${passCount}</div>
      </div>
      <div class="card">
        <div class="card-label">Needs Attention</div>
        <div class="card-value" style="color:var(--amber)">${d.length-passCount}</div>
      </div>
    </div>`;

    html += `<div class="card-grid card-grid-2">`;
    d.forEach(p => {
      const score = typeof p.score === 'number' ? p.score : null;
      html += `<div class="card">
        <div class="agent-header">
          <span class="agent-name">${escHtml(p.name)}</span>
          ${badge(p.status || 'UNKNOWN')}
        </div>
        <div class="score-ring-wrap">
          ${score !== null ? scoreRing(score) : '<div style="color:var(--text-muted);font-size:12px">No score</div>'}
          <div>
            <div class="stat-label" style="margin-bottom:4px">Hook: <code style="color:var(--accent-light)">${escHtml(String(p.hook))}</code></div>
            <div class="stat-label">Checks: ${p.checksPassed !== null ? `${p.checksPassed}/${p.checksTotal}` : 'N/A'}</div>
            <div class="stat-label" style="margin-top:4px">Evidence: ${badge(p.runtimeEvidence?'PASS':'FAIL')}</div>
          </div>
        </div>
        ${score !== null ? progressBar(score) : ''}
        <div class="card-meta" style="margin-top:8px">Last: ${escHtml(String(p.lastResult))}</div>
      </div>`;
    });
    html += `</div>`;
    set('plugins-content', html);
  } catch(e) {
    set('plugins-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: SKILLS ─────────────────────────────────────────────────────────────
async function loadSkills() {
  set('skills-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/skills');
    let html = `<div class="table-container">
      <div class="table-header">
        <span class="table-title">Registered Skills</span>
        <span class="table-count">${d.length} skills</span>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Skill Variable</th><th>Registered</th><th>Loaded</th>
          <th>Executed</th><th>Runtime Status</th><th>Last Result</th>
        </tr></thead>
        <tbody>${d.map(s => `<tr>
          <td style="font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">${escHtml(s.varName)}</td>
          <td>${badge(s.registered?'PASS':'FAIL')}</td>
          <td>${badge(s.loaded?'PASS':'FAIL')}</td>
          <td>${badge(s.executed?'PASS':'FAIL')}</td>
          <td>${badge(s.runtimeStatus||'UNKNOWN')}</td>
          <td style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis">${escHtml(s.lastResult||'No evidence')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
    set('skills-content', html);
  } catch(e) {
    set('skills-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: AGENTS ─────────────────────────────────────────────────────────────
async function loadAgents() {
  set('agents-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/agents');
    let html = `<div class="card-grid">`;
    d.forEach(a => {
      html += `<div class="agent-card">
        <div class="agent-header">
          <span class="agent-name">${escHtml(a.name)}</span>
          <span class="agent-state-badge">${badge(a.runtimeState||'UNKNOWN')}</span>
        </div>
        <div class="agent-task">📋 ${escHtml(a.currentTask||'Idle')}</div>
        <div class="agent-stats">
          <div class="agent-stat">
            <strong>${a.queue ?? 0}</strong>
            Queue
          </div>
          <div class="agent-stat" style="margin-left:auto">
            ${badge(a.evidence ? 'PASS' : 'FAIL')}
            <span style="margin-left:4px;font-size:10px">Evidence</span>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
    set('agents-content', html);
  } catch(e) {
    set('agents-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: PROJECT ────────────────────────────────────────────────────────────
async function loadProject() {
  set('project-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/project');
    let html = `<div class="overview-hero">
      <div class="hero-left">
        <h2>${escHtml(d.currentProject)}</h2>
        <p>${escHtml(d.currentPhase)}</p>
      </div>
      <div class="hero-score">
        <div class="hero-score-label">Health Score</div>
        <div class="hero-score-value" style="font-size:28px">${escHtml(d.healthScore||'---')}</div>
      </div>
    </div>`;

    html += `<div class="card-grid">
      <div class="card">
        <div class="card-label">Tool Count</div>
        <div class="card-value">${d.toolCount ?? 0}</div>
        <div class="card-meta">Astro pages generated</div>
      </div>
      <div class="card">
        <div class="card-label">Generated Pages</div>
        <div class="card-value">${d.generatedPages ?? 0}</div>
        <div class="card-meta">In src/pages/tools/</div>
      </div>
      <div class="card">
        <div class="card-label">Deployments</div>
        <div class="card-value" style="color:var(--green)">${d.deployments ?? 0}</div>
        <div class="card-meta">Cloudflare staging pushes</div>
      </div>
      <div class="card">
        <div class="card-label">Completed Jobs</div>
        <div class="card-value" style="color:var(--green)">${d.completedJobs ?? 0}</div>
        <div class="card-meta">SQLite orchestrator DB</div>
      </div>
      <div class="card">
        <div class="card-label">Failed Jobs</div>
        <div class="card-value" style="color:${d.failedJobs>0?'var(--red)':'var(--green)'}">${d.failedJobs ?? 0}</div>
        <div class="card-meta">Requires recovery</div>
      </div>
      <div class="card">
        <div class="card-label">Errors</div>
        <div class="card-value" style="color:${d.errors>0?'var(--amber)':'var(--green)'}">${d.errors ?? 0}</div>
        <div class="card-meta">Plugin audit failures</div>
      </div>
      <div class="card">
        <div class="card-label">Warnings</div>
        <div class="card-value" style="color:${d.warnings>0?'var(--amber)':'var(--green)'}">${d.warnings ?? 0}</div>
        <div class="card-meta">Soft failures in audits</div>
      </div>
    </div>`;
    set('project-content', html);
  } catch(e) {
    set('project-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: LOGS ───────────────────────────────────────────────────────────────
function loadLogs() {
  startLogStream();
}

function setLogSource(src, btn) {
  logSource = src;
  document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  logLines = [];
  startLogStream();
}

function clearLogView() {
  logLines = [];
  renderLogTerminal();
}

function startLogStream() {
  if (logEventSource) { logEventSource.close(); logEventSource = null; }
  // Use polling for logs (SSE fallback)
  fetchLogs();
  if (refreshTimer) { clearInterval(refreshTimer); }
  refreshTimer = setInterval(fetchLogs, 3000);
}

async function fetchLogs() {
  try {
    const d = await api(`/api/logs?source=${logSource}`);
    if (d.lines && d.lines.length > 0) {
      const newLines = d.lines.filter(l => !logLines.includes(l));
      logLines = d.lines;
      renderLogTerminal();
    }
  } catch(e) {
    const term = el('log-terminal');
    if (term) term.innerHTML = `<div class="log-line fail">Error fetching logs: ${escHtml(e.message)}</div>`;
  }
}

function renderLogTerminal() {
  const term = el('log-terminal');
  if (!term) return;
  if (logLines.length === 0) {
    term.innerHTML = '<div class="log-placeholder">No log entries found for this source.</div>';
    return;
  }
  const html = logLines.map(line => {
    let cls = 'log-line';
    const low = line.toLowerCase();
    if (low.includes('error') || low.includes('fail') || low.includes('✗')) cls += ' fail';
    else if (low.includes('warn')) cls += ' warn';
    else if (low.includes('pass') || low.includes('✓') || low.includes('completed')) cls += ' pass';
    else if (low.includes('deploy') || low.includes('staging') || low.includes('cloudflare')) cls += ' deploy';
    else if (low.includes('transition') || low.includes('state:')) cls += ' state';
    else if (low.includes('info') || low.includes('start')) cls += ' info';
    return `<div class="${cls}">${escHtml(line)}</div>`;
  }).join('');
  term.innerHTML = html;
  if (document.getElementById('auto-scroll')?.checked) {
    term.scrollTop = term.scrollHeight;
  }
}

// ─── PAGE: GITHUB ─────────────────────────────────────────────────────────────
async function loadGithub() {
  set('github-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/github');
    let html = `<div class="card-grid card-grid-2">
      <div class="card card-accent">
        <div class="card-label">Repository</div>
        <div class="card-value sm" style="word-break:break-all">${escHtml(d.repo||'Unknown')}</div>
        <div class="card-meta">Remote origin</div>
      </div>
      <div class="card">
        <div class="card-label">Branch</div>
        <div class="card-value sm">⎇ ${escHtml(d.branch||'Unknown')}</div>
        <div class="card-meta">Current active branch</div>
      </div>
      <div class="card">
        <div class="card-label">Sync Status</div>
        <div class="card-value sm">${badge(d.syncStatus||'UNKNOWN')}</div>
        <div class="card-meta">${d.dirtyFiles?.length ? `${d.dirtyFiles.length} modified file(s)` : 'Working tree clean'}</div>
      </div>
      <div class="card">
        <div class="card-label">Push Status</div>
        <div class="card-value sm">${badge(d.pushStatus?.includes('ahead')?'WARN':'PASS')}</div>
        <div class="card-meta">${escHtml(d.pushStatus||'Unknown')}</div>
      </div>
    </div>`;

    // Latest commit
    if (d.commit?.hash) {
      html += `<div class="section-title">Latest Commit</div>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Hash</span><span class="stat-value">${escHtml(d.commit.hash)}</span></div>
        <div class="stat-row"><span class="stat-label">Message</span><span class="stat-value" style="max-width:400px;text-overflow:ellipsis;overflow:hidden">${escHtml(d.commit.message||'N/A')}</span></div>
        <div class="stat-row"><span class="stat-label">Date</span><span class="stat-value">${escHtml(d.commit.date||'N/A')}</span></div>
      </div>`;
    }

    // Modified files
    if (d.dirtyFiles?.length > 0) {
      html += `<div class="section-title">Modified Files (${d.dirtyFiles.length})</div>
      <div class="card">
        <div class="chip-list">${d.dirtyFiles.map(f=>`<span class="chip" style="color:var(--amber);border-color:rgba(245,158,11,0.3)">${escHtml(f)}</span>`).join('')}</div>
      </div>`;
    }
    set('github-content', html);
  } catch(e) {
    set('github-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: DEPLOYMENT ─────────────────────────────────────────────────────────
async function loadDeployment() {
  set('deployment-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/deployment');
    let html = `<div class="card-grid">
      <div class="card card-accent">
        <div class="card-label">Cloudflare Status</div>
        <div class="card-value sm">${badge(d.cloudflareStatus||'UNKNOWN')}</div>
        <div class="card-meta">Pages integration</div>
      </div>
      <div class="card">
        <div class="card-label">Pages Status</div>
        <div class="card-value sm">${badge(d.pagesStatus||'UNKNOWN')}</div>
        <div class="card-meta">${d.totalDeployments} total deployments</div>
      </div>
      <div class="card">
        <div class="card-label">Deploy Status</div>
        <div class="card-value sm">${badge(d.deployStatus||'UNKNOWN')}</div>
        <div class="card-meta">Last pipeline result</div>
      </div>
      <div class="card">
        <div class="card-label">Domain Status</div>
        <div class="card-value sm">${badge(d.domainStatus||'UNKNOWN')}</div>
        <div class="card-meta">.pages.dev subdomain</div>
      </div>
      <div class="card">
        <div class="card-label">GSC Queue</div>
        <div class="card-value sm">${badge(d.gscQueue||'NOT_QUEUED')}</div>
        <div class="card-meta">Google Search Console</div>
      </div>
      <div class="card">
        <div class="card-label">AdSense Queue</div>
        <div class="card-value sm">${badge(d.adsenseQueue||'NOT_QUEUED')}</div>
        <div class="card-meta">Revenue monetization</div>
      </div>
    </div>`;

    if (d.lastStagingUrl) {
      html += `<div class="section-title">Latest Staging URL</div>
      <div class="card">
        <div class="card-label">Live at</div>
        <div class="card-value sm"><a href="${escHtml(d.lastStagingUrl)}" target="_blank" style="color:var(--accent-light)">${escHtml(d.lastStagingUrl)}</a></div>
      </div>`;
    }

    if (d.allStagingUrls?.length > 0) {
      html += `<div class="section-title">All Staging Deployments (${d.allStagingUrls.length})</div>
      <div class="card">
        ${d.allStagingUrls.map((u,i)=>`<div class="stat-row">
          <span class="stat-label">#${i+1}</span>
          <a href="${escHtml(u)}" target="_blank" class="stat-value" style="color:var(--accent-light)">${escHtml(u)}</a>
        </div>`).join('')}
      </div>`;
    }
    set('deployment-content', html);
  } catch(e) {
    set('deployment-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ─── PAGE: AUDIT ──────────────────────────────────────────────────────────────
async function loadAudit() {
  set('audit-content', '<div class="loading-spinner"></div>');
  try {
    const d = await api('/api/audit');
    const passing = d.filter(a=>a.status==='PASS').length;
    let html = `<div class="card-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
      <div class="card card-accent">
        <div class="card-label">Total Audits</div>
        <div class="card-value">${d.length}</div>
      </div>
      <div class="card">
        <div class="card-label">Passing</div>
        <div class="card-value" style="color:var(--green)">${passing}</div>
      </div>
      <div class="card">
        <div class="card-label">Need Review</div>
        <div class="card-value" style="color:var(--amber)">${d.length-passing}</div>
      </div>
    </div>`;

    html += `<div class="card-grid card-grid-2">`;
    d.forEach(a => {
      const statusColor = a.status==='PASS'?'var(--green)':a.status==='WARN'?'var(--amber)':'var(--red)';
      html += `<div class="audit-card">
        <div class="audit-type">${escHtml(a.type)} Audit</div>
        <div class="audit-status" style="color:${statusColor}">${badge(a.status)} ${a.exists?'':'<span style="font-size:11px;color:var(--red)">File not found</span>'}</div>
        ${a.score ? `<div class="audit-score">Score: ${escHtml(a.score)}</div>` : ''}
        <div class="audit-summary">${escHtml(a.summary||'')}</div>
        ${a.lastModified ? `<div class="card-meta" style="margin-top:8px">Updated: ${new Date(a.lastModified).toLocaleString()}</div>` : ''}
      </div>`;
    });
    html += `</div>`;
    set('audit-content', html);
  } catch(e) {
    set('audit-content', `<div class="error-state"><h3>API Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACTION SYSTEM — POST API calls for real operations
// ═══════════════════════════════════════════════════════════════════════════

async function postAction(actionName, body = {}) {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: actionName, ...body })
  });
  return res.json();
}

// ─── FIRE ACTION + POLL ──────────────────────────────────────────────────────
let activePolls = new Map();

async function fireAction(actionName, extraBody = {}) {
  showToast(`Starting: ${actionName}...`, 'running');
  try {
    const result = await postAction(actionName, extraBody);
    if (result.error) { showToast(`Error: ${result.error}`, 'error'); return result; }
    if (result.actionId) {
      showToast(`${actionName} started (${result.actionId})`, 'running');
      pollAction(result.actionId, actionName);
    } else {
      showToast(`${actionName}: ${result.message || 'Done'}`, 'success');
    }
    return result;
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error');
    return { error: e.message };
  }
}

function pollAction(actionId, label) {
  if (activePolls.has(actionId)) return;
  const interval = setInterval(async () => {
    try {
      const result = await postAction('status', { actionId });
      if (result.status && result.status !== 'RUNNING') {
        clearInterval(interval);
        activePolls.delete(actionId);
        const cls = result.status === 'SUCCESS' ? 'success' : 'error';
        showToast(`${label}: ${result.status}`, cls);
        // Auto-refresh current page
        refreshCurrent();
      }
    } catch {}
  }, 2000);
  activePolls.set(actionId, interval);
}

// ─── PAGE: TERMINAL ──────────────────────────────────────────────────────────
let terminalActionId = null;
let terminalPollInterval = null;

function loadTerminal() {
  // Focus input
  setTimeout(() => {
    const inp = document.getElementById('terminal-input');
    if (inp) inp.focus();
  }, 100);
}

async function runTerminalCmd() {
  const inp = document.getElementById('terminal-input');
  const cmd = inp.value.trim();
  if (!cmd) return;

  const termOut = document.getElementById('terminal-output');
  termOut.innerHTML = `<div class="log-line state">$ ${escHtml(cmd)}</div><div class="log-line info">Running...</div>`;

  try {
    const result = await postAction('terminal', { command: cmd });
    if (result.error) {
      termOut.innerHTML += `<div class="log-line fail">Error: ${escHtml(result.error)}</div>`;
      return;
    }
    terminalActionId = result.actionId;
    // Poll for output
    if (terminalPollInterval) clearInterval(terminalPollInterval);
    terminalPollInterval = setInterval(async () => {
      const status = await postAction('status', { actionId: terminalActionId });
      let html = `<div class="log-line state">$ ${escHtml(cmd)}</div>`;
      if (status.output) {
        const lines = status.output.split('\n');
        lines.forEach(line => {
          let cls = 'log-line';
          const low = line.toLowerCase();
          if (low.includes('error') || low.includes('fail')) cls += ' fail';
          else if (low.includes('warn')) cls += ' warn';
          else if (low.includes('✓') || low.includes('pass') || low.includes('success')) cls += ' pass';
          else if (low.includes('deploy') || low.includes('staging')) cls += ' deploy';
          html += `<div class="${cls}">${escHtml(line)}</div>`;
        });
      }
      if (status.status && status.status !== 'RUNNING') {
        clearInterval(terminalPollInterval);
        terminalPollInterval = null;
        const exitCls = status.exitCode === 0 ? 'pass' : 'fail';
        html += `<div class="log-line ${exitCls}">── Process exited with code ${status.exitCode} (${status.status}) ──</div>`;
      }
      termOut.innerHTML = html;
      termOut.scrollTop = termOut.scrollHeight;
    }, 1000);
  } catch (e) {
    termOut.innerHTML += `<div class="log-line fail">Error: ${escHtml(e.message)}</div>`;
  }
  inp.value = '';
}

function runQuickCmd(cmd) {
  const inp = document.getElementById('terminal-input');
  inp.value = cmd;
  runTerminalCmd();
}

// ─── PAGE: ACTIONS ───────────────────────────────────────────────────────────
async function loadActions() {
  // Load task editors
  try {
    const overview = await api('/api/overview');
    const ctEl = document.getElementById('edit-current-task');
    const ntEl = document.getElementById('edit-next-task');
    if (ctEl && overview.currentTask) ctEl.value = overview.currentTask;
    if (ntEl && overview.nextTask) ntEl.value = overview.nextTask;
  } catch {}

  // Load action history
  try {
    const result = await postAction('status', {});
    const acts = result.actions || [];
    if (acts.length === 0) {
      set('action-history', '<div style="color:var(--text-muted);padding:16px;font-size:13px">No actions executed yet. Use the quick actions above to start.</div>');
      return;
    }
    let html = `<div class="table-container">
      <div class="table-header">
        <span class="table-title">Recent Actions</span>
        <span class="table-count">${acts.length} actions</span>
      </div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Command</th><th>Status</th><th>Started</th><th>Duration</th><th>Output</th></tr></thead>
        <tbody>`;
    acts.forEach(a => {
      const statusCls = `action-status-${(a.status||'').toLowerCase()}`;
      const dur = a.completedAt && a.startedAt
        ? `${((new Date(a.completedAt) - new Date(a.startedAt))/1000).toFixed(1)}s`
        : 'running...';
      const started = a.startedAt ? new Date(a.startedAt).toLocaleTimeString() : '';
      html += `<tr>
        <td class="mono" style="font-size:11px">${escHtml(a.id)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;font-size:12px">${escHtml((a.cmd||'').slice(0,80))}</td>
        <td><span class="${statusCls}" style="font-weight:700">${escHtml(a.status||'UNKNOWN')}</span></td>
        <td style="font-size:11px">${started}</td>
        <td class="mono" style="font-size:11px">${dur}</td>
        <td><span class="action-output-toggle" onclick="toggleActionOutput('${a.id}')">Show</span>
          <div id="output-${a.id}" style="display:none">
            <pre class="action-output-pre">${escHtml((a.output||'').slice(0,5000))}</pre>
          </div>
        </td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    set('action-history', html);
  } catch(e) {
    set('action-history', `<div class="error-state"><h3>Error</h3><p>${escHtml(e.message)}</p></div>`);
  }
}

function toggleActionOutput(actionId) {
  const el = document.getElementById(`output-${actionId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveTask(type) {
  const field = type === 'current' ? 'edit-current-task' : 'edit-next-task';
  const content = document.getElementById(field).value;
  const actionName = type === 'current' ? 'update-task' : 'update-next-task';
  try {
    const result = await postAction(actionName, { content });
    if (result.error) { showToast(`Error: ${result.error}`, 'error'); return; }
    showToast(result.message || 'Saved!', 'success');
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error');
  }
}

// ─── MODAL SYSTEM ────────────────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function showGitCommitModal() {
  openModal('Git Commit & Push',
    `<label>Commit Message</label>
     <input type="text" id="git-commit-msg" placeholder="chore: update from Control Center" />`,
    `<button class="btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn-action" onclick="doGitPush()">Commit & Push</button>`
  );
  setTimeout(() => {
    const inp = document.getElementById('git-commit-msg');
    if (inp) inp.focus();
  }, 200);
}

async function doGitPush() {
  const msg = document.getElementById('git-commit-msg').value.trim();
  closeModal();
  await fireAction('git-push', { message: msg || undefined });
}

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
function showToast(message, type = 'running') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', running: '⟳' };
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
