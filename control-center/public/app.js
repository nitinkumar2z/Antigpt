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
    logs:'Logs Viewer', github:'GitHub Dashboard', deployment:'Deployment Dashboard', audit:'Audit Dashboard'
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
    audit:      loadAudit
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
