/**
 * Core Application Logic for the GitHub-Based Project Control System
 */

// --- Central Data Store ---
const state = {
  activeTab: 'overview',
  commitHash: '938fa2a2',
  releaseTag: 'plugin-layer-v1',
  stagingStatus: 'Staged',
  productionStatus: 'Awaiting Gate',
  governor: {
    maxExecutionTimeMs: 30000,
    maxSequenceBudgetMs: 90000,
    whitelist: {
      github: ['deployment-guardian'],
      playwright: ['qa-automation', 'weekly-seo-engine'],
      postgres: ['tool-planner', 'weekly-seo-engine'],
      sqlite: ['weekly-seo-engine', 'google-update-engine']
    },
    violations: 0
  },
  scores: {
    quality: 826,
    seo: 93,
    aeo: 71,
    deploy: 83,
    qa: 100
  },
  issues: [
    {
      id: 1,
      title: 'Implement semantic-match vector distance check',
      desc: 'Verify if page headings and body text match target user intents using vector similarities.',
      priority: 'high',
      assignee: 'Content Re-Writer Agent',
      status: 'todo'
    },
    {
      id: 2,
      title: 'Verify Cloudflare Edge Worker env bindings',
      desc: 'Ensure all bindings for Edge deployment match production guidelines.',
      priority: 'medium',
      assignee: 'Deploy & Recovery Agent',
      status: 'todo'
    },
    {
      id: 3,
      title: 'Perform manual WCAG audit on landing templates',
      desc: 'Lighthouse audits flagged structural elements with low color contrast.',
      priority: 'medium',
      assignee: 'Content Re-Writer Agent',
      status: 'todo'
    },
    {
      id: 4,
      title: 'Refactor utility functions to centralized Skills layer',
      desc: 'Move common behaviors (HTML parsing, syllabary logic) from inline functions to standalone reusable Skills.',
      priority: 'high',
      assignee: 'Content Re-Writer Agent',
      status: 'progress'
    },
    {
      id: 5,
      title: 'Weekly SEO operations engine schedule sync',
      desc: 'Align scheduled cron jobs with local system updates database triggers.',
      priority: 'medium',
      assignee: 'Trend Discovery Agent',
      status: 'review'
    },
    {
      id: 6,
      title: 'Implement System Governor gating logic',
      desc: 'Enforce access control policies, execution budgets, and publish gating thresholds.',
      priority: 'critical',
      assignee: 'Deploy & Recovery Agent',
      status: 'done'
    },
    {
      id: 7,
      title: 'Register 9 production plugins with 47 checks',
      desc: 'Bootstrap the complete plugin lifecycle manager and bind hooks.',
      priority: 'critical',
      assignee: 'Deploy & Recovery Agent',
      status: 'done'
    }
  ],
  skills: [
    { name: 'text:flesch-readability', category: 'text', title: 'Flesch Readability Heuristic', desc: 'Estimates word, sentence, and syllable count to apply Flesch-Kincaid ease indexing.', pfx: 'Priority 1' },
    { name: 'text:ngram-similarity', category: 'text', title: 'N-gram Duplicate Fingerprinter', desc: 'Calculates Jaccard overlap ratios of token sets to evaluate plagiarism risks.', pfx: 'Priority 1' },
    { name: 'text:semantic-match', category: 'text', title: 'Semantic Keyword Intent Matcher', desc: 'Validates keyword occurrence density using context7 references.', pfx: 'Priority 2' },
    { name: 'text:eeat-credibility', category: 'text', title: 'E-E-A-T trust signals check', desc: 'Extracts author bios, citations, and verifies Wikidata registry links.', pfx: 'Priority 2' },
    { name: 'html:structural-validator', category: 'html', title: 'DOM Heading Structure Auditor', desc: 'Enforces heading progression (H1-H6) and audits skip-navigation accessibility hooks.', pfx: 'Priority 1' },
    { name: 'html:jsonld-validator', category: 'html', title: 'JSON-LD Schema Scraper', desc: 'Scrapes page scripts, parses schema syntax, and validates Article/FAQ structures.', pfx: 'Priority 1' },
    { name: 'html:link-integrity', category: 'html', title: 'Anchor Format & Canonical Auditor', desc: 'Audits internal link distributions and verifies HTTPS canonical parameters.', pfx: 'Priority 1' },
    { name: 'html:media-accessibility', category: 'html', title: 'Media Loading & Aspect Auditor', desc: 'Verifies presence of loading="lazy", dimensions, and alt text attributes.', pfx: 'Priority 1' },
    { name: 'integration:playwright-render', category: 'integration', title: 'Headless Browser DOM Auditor', desc: 'Launches visual rendering checking layout shifts (CLS) and JavaScript errors.', pfx: 'Priority 3' },
    { name: 'integration:accessibility-axe', category: 'integration', title: 'WCAG Accessibility Inspector', desc: 'Triggers automated axe-core audits to evaluate keyboard navigation and ARIA tags.', pfx: 'Priority 3' },
    { name: 'integration:rss-feed-monitor', category: 'integration', title: 'RSS Algorithm Scraping engine', desc: 'Scrapes Google RSS search developer feeds to alert on new core updates.', pfx: 'Priority 2' },
    { name: 'integration:cloudflare-check', category: 'integration', title: 'Cloudflare Pages Size Auditor', desc: 'Checks serverless worker file sizes and environment bindings constraints.', pfx: 'Priority 2' },
    { name: 'integration:github-status', category: 'integration', title: 'Git Status & Lockfile Check', desc: 'Audits dirty local file trees and queries active GitHub workflows.', pfx: 'Priority 2' },
    { name: 'db:relational-planner', category: 'db', title: 'Relational Database Schema Auditor', desc: 'Validates syntax of CREATE scripts for SQLite and PostgreSQL.', pfx: 'Priority 2' },
    { name: 'db:performance-index', category: 'db', title: 'Index Distribution Reviewer', desc: 'Queries schema catalogs to find unindexed columns scanned in critical tasks.', pfx: 'Priority 2' }
  ],
  commits: [
    { hash: '938fa2a2', author: 'AI Architect', time: '10 min ago', msg: 'feat(governor): implement report generation, cron schedules, and gating policies' },
    { hash: '78ba231d', author: 'AI Architect', time: '1 hour ago', msg: 'docs: add architecture reports, plans, and system governor lite integration' },
    { hash: '7ad62045', author: 'GitHub Pipeline', time: '3 hours ago', msg: 'feat(plugins): release production plugin layer v1.0.0 with 9 plugins' }
  ]
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  renderCommits();
  renderKanban();
  renderSkills('all');
  setupSliders();
  setupGovernorForm();
  setupSimulationControls();
  
  // Initial gating row populate
  updateOverviewTable();
});

// --- Tab System ---
function setupTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      
      // Update active nav
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update active pane
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      state.activeTab = tabId;
    });
  });
}

// --- Render Commits ---
function renderCommits() {
  const feed = document.getElementById('commit-feed');
  feed.innerHTML = state.commits.map(c => `
    <div class="commit-item">
      <div class="commit-avatar">
        <i class="fa-solid fa-code"></i>
      </div>
      <div class="commit-content">
        <div class="commit-header">
          <span class="commit-author">${c.author}</span>
          <span class="commit-time">${c.time}</span>
        </div>
        <div class="commit-msg">
          <strong><code>${c.hash}</code></strong> - ${c.msg}
        </div>
      </div>
    </div>
  `).join('');
}

// --- Render Kanban ---
function renderKanban() {
  const cols = {
    todo: document.querySelector('#col-todo .kanban-cards-container'),
    progress: document.querySelector('#col-progress .kanban-cards-container'),
    review: document.querySelector('#col-review .kanban-cards-container'),
    done: document.querySelector('#col-done .kanban-cards-container')
  };
  
  // Reset counts
  document.querySelector('#col-todo .column-count').innerText = state.issues.filter(i => i.status === 'todo').length;
  document.querySelector('#col-progress .column-count').innerText = state.issues.filter(i => i.status === 'progress').length;
  document.querySelector('#col-review .column-count').innerText = state.issues.filter(i => i.status === 'review').length;
  document.querySelector('#col-done .column-count').innerText = state.issues.filter(i => i.status === 'done').length;

  // Clear cols
  Object.values(cols).forEach(c => c.innerHTML = '');
  
  state.issues.forEach(issue => {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = issue.id;
    
    let priorityClass = `priority-${issue.priority}`;
    let tagClass = 'purple-bg';
    if (issue.priority === 'critical') tagClass = 'red-bg';
    if (issue.priority === 'medium') tagClass = 'cyan-bg';
    
    card.innerHTML = `
      <div class="card-tag ${tagClass}">${issue.priority}</div>
      <h4>${issue.title}</h4>
      <p>${issue.desc}</p>
      <div class="card-meta">
        <span class="card-assignee">
          <i class="fa-solid fa-robot"></i> ${issue.assignee}
        </span>
        <span class="priority-tag ${priorityClass}">${issue.priority.toUpperCase()}</span>
      </div>
    `;
    
    // Add drag and drop listeners
    card.addEventListener('dragstart', () => {
      card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    
    cols[issue.status].appendChild(card);
  });
  
  // Set up container listeners for drops
  Object.keys(cols).forEach(status => {
    const container = cols[status];
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingCard = document.querySelector('.dragging');
      if (draggingCard) {
        container.appendChild(draggingCard);
      }
    });
    
    container.addEventListener('drop', () => {
      const draggingCard = document.querySelector('.dragging');
      if (draggingCard) {
        const id = parseInt(draggingCard.dataset.id);
        const issue = state.issues.find(i => i.id === id);
        if (issue && issue.status !== status) {
          issue.status = status;
          showToast('info', 'Issue Status Updated', `Moved task to ${status.toUpperCase()}`);
          renderKanban();
        }
      }
    });
  });
}

// Modal handling
const modal = document.getElementById('new-issue-modal');
document.getElementById('new-issue-btn').addEventListener('click', () => modal.classList.add('show'));
document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.remove('show'));
document.getElementById('cancel-modal-btn').addEventListener('click', () => modal.classList.remove('show'));

document.getElementById('new-issue-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('issue-title').value;
  const desc = document.getElementById('issue-desc').value;
  const priority = document.getElementById('issue-priority').value;
  const agent = document.getElementById('issue-assignee').value;
  
  let assigneeText = 'Content Re-Writer Agent';
  if (agent === 'deploy') assigneeText = 'Deploy & Recovery Agent';
  if (agent === 'trend') assigneeText = 'Trend Discovery Agent';

  const newIssue = {
    id: Date.now(),
    title,
    desc,
    priority,
    assignee: assigneeText,
    status: 'todo'
  };

  state.issues.push(newIssue);
  modal.classList.remove('show');
  document.getElementById('new-issue-form').reset();
  
  showToast('success', 'Issue Created', 'New task added to To Do board.');
  renderKanban();
});

// --- Sliders & Overview update ---
function setupSliders() {
  const updateVal = (id, val, divider = 100) => {
    document.getElementById(`val-${id}`).innerText = `${val} / ${divider}`;
    state.scores[id] = parseInt(val);
    
    // Sync overview widgets
    if (id === 'quality') {
      document.getElementById('gauge-score-text').innerText = val;
      const progress = val / 1000;
      const circumference = 314; // 2 * PI * r (r=50)
      const offset = circumference * (1 - progress);
      document.getElementById('gauge-circle').style.strokeDashoffset = offset;
      
      const label = document.getElementById('publish-band-label');
      const desc = document.querySelector('.health-meta .description');
      
      if (val < 700) {
        label.innerText = 'REJECT (Red)';
        label.className = 'health-tag status-red';
        desc.innerText = 'Gating score blocked. Automatic Rollback loop triggered.';
        document.getElementById('prod-deploy-status').innerText = 'Deploy Blocked';
        document.getElementById('prod-deploy-status').className = 'env-status status-failed';
        document.getElementById('prod-deploy-desc').innerText = 'System Governor rejected deployment';
        document.getElementById('prod-deploy-progress').style.width = '0%';
        document.getElementById('prod-deploy-progress').className = 'progress-bar bg-cyan';
      } else if (val < 800) {
        label.innerText = 'NEEDS FIX (Yellow)';
        label.className = 'health-tag status-yellow';
        desc.innerText = 'Staging permitted, production blocked. Content Re-Writer alerted.';
        document.getElementById('prod-deploy-status').innerText = 'Needs Action';
        document.getElementById('prod-deploy-status').className = 'env-status status-pending';
        document.getElementById('prod-deploy-desc').innerText = 'Awaiting auto-remediation';
        document.getElementById('prod-deploy-progress').style.width = '50%';
        document.getElementById('prod-deploy-progress').className = 'progress-bar bg-yellow';
      } else {
        label.innerText = 'PUBLISH (Green)';
        label.className = 'health-tag status-green';
        desc.innerText = 'Pre-publish sequence successfully completed. Ready for production release.';
        document.getElementById('prod-deploy-status').innerText = 'Deploy Approved';
        document.getElementById('prod-deploy-status').className = 'env-status status-active';
        document.getElementById('prod-deploy-desc').innerText = 'Pre-publish gating tests passed';
        document.getElementById('prod-deploy-progress').style.width = '100%';
        document.getElementById('prod-deploy-progress').className = 'progress-bar bg-green';
      }
    }
    updateOverviewTable();
  };

  ['quality', 'seo', 'aeo', 'deploy', 'qa'].forEach(id => {
    const slider = document.getElementById(`slider-${id}`);
    const div = id === 'quality' ? 1000 : 100;
    
    slider.addEventListener('input', (e) => {
      updateVal(id, e.target.value, div);
    });
  });
}

function updateOverviewTable() {
  const tbody = document.getElementById('overview-plugin-rows');
  
  const plugins = [
    { name: 'quality-gatekeeper', hooks: ['pre-publish', 'on-schedule'], mode: 'fail-closed', checks: 7, thresh: '800/1000', actual: state.scores.quality, max: 1000 },
    { name: 'seo-auditor', hooks: ['post-build', 'on-schedule'], mode: 'fail-open', checks: 12, thresh: '70/100', actual: state.scores.seo, max: 100 },
    { name: 'aeo-auditor', hooks: ['post-build', 'on-schedule'], mode: 'fail-open', checks: 10, thresh: '65/100', actual: state.scores.aeo, max: 100 },
    { name: 'deployment-guardian', hooks: ['pre-publish'], mode: 'fail-closed', checks: 3, thresh: '80/100', actual: state.scores.deploy, max: 100 },
    { name: 'qa-automation', hooks: ['post-build', 'pre-publish'], mode: 'fail-closed', checks: 3, thresh: '70/100', actual: state.scores.qa, max: 100 }
  ];

  tbody.innerHTML = plugins.map(p => {
    const pass = p.actual >= parseInt(p.thresh);
    const statusText = pass ? '<span class="text-green"><i class="fa-solid fa-circle-check"></i> Pass</span>' : 
                      p.mode === 'fail-closed' ? '<span class="text-red"><i class="fa-solid fa-circle-xmark"></i> Block</span>' : '<span class="text-yellow"><i class="fa-solid fa-triangle-exclamation"></i> Warn</span>';
    
    return `
      <tr>
        <td><strong><code>${p.name}</code></strong></td>
        <td>${p.hooks.map(h => `<span class="badge cyan-bg text-xs" style="padding: 2px 6px;">${h}</span>`).join(' ')}</td>
        <td><code>${p.mode}</code></td>
        <td>${p.checks} checks</td>
        <td><code>${p.thresh}</code></td>
        <td style="font-weight: 600;">${p.actual}/${p.max}</td>
        <td>${statusText}</td>
      </tr>
    `;
  }).join('');
}

// --- Skills Catalog Filtering ---
function renderSkills(category) {
  const container = document.getElementById('skills-catalog-grid');
  const filtered = category === 'all' ? state.skills : state.skills.filter(s => s.category === category);
  
  container.innerHTML = filtered.map(s => `
    <div class="skill-card">
      <div class="skill-card-header">
        <span class="skill-name-tag">${s.name}</span>
        <span class="badge text-xs ${s.pfx === 'Priority 1' ? 'green-bg' : s.pfx === 'Priority 2' ? 'purple-bg' : 'yellow-bg'}">${s.pfx}</span>
      </div>
      <div class="skill-card-body">
        <h4>${s.title}</h4>
        <p>${s.desc}</p>
      </div>
      <div class="skill-meta">
        <span class="skill-badge">${s.category.toUpperCase()}</span>
        <span class="skill-badge">0-100 Score</span>
      </div>
    </div>
  `).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSkills(btn.getAttribute('data-filter'));
  });
});

// --- Governor Policy Form ---
function setupGovernorForm() {
  const form = document.getElementById('governor-policy-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const maxExec = document.getElementById('policy-max-exec').value;
    const maxSeq = document.getElementById('policy-max-sequence').value;
    
    state.governor.maxExecutionTimeMs = parseInt(maxExec);
    state.governor.maxSequenceBudgetMs = parseInt(maxSeq);
    
    showToast('success', 'Governor Policy Saved', 'Real-time limits and timeouts updated successfully.');
  });
  
  document.getElementById('reset-policy-btn').addEventListener('click', () => {
    document.getElementById('policy-max-exec').value = 30000;
    document.getElementById('policy-max-sequence').value = 90000;
    showToast('info', 'Defaults Restored', 'System Governor policy reset to architectural guidelines.');
  });
}

// --- Gating Pipeline Simulation Controls ---
function setupSimulationControls() {
  const consoleEl = document.getElementById('console-logs');
  
  const addLog = (type, text) => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${text}`;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  document.getElementById('clear-console-btn').addEventListener('click', () => {
    consoleEl.innerHTML = '<div class="log-entry system">[SYSTEM] Console Cleared.</div>';
  });

  // Trigger quick run from Overview
  document.getElementById('quick-run-btn').addEventListener('click', () => {
    document.querySelector('.nav-item[data-tab="pipeline"]').click();
    setTimeout(() => {
      document.getElementById('trigger-pipeline-btn').click();
    }, 200);
  });

  const runButton = document.getElementById('trigger-pipeline-btn');
  runButton.addEventListener('click', () => {
    runButton.disabled = true;
    consoleEl.innerHTML = '';
    
    addLog('info', 'System Governor initiated. Hook: <b>pre-publish</b> triggered.');
    
    // Simulate check sequence
    let currentStep = 0;
    const steps = [
      () => addLog('system', 'Auditing registered plugins... Found 5 bound to hook pre-publish.'),
      () => addLog('system', `Checking sequence limits. Budget ceiling: ${state.governor.maxSequenceBudgetMs}ms. Accumulator reset.`),
      () => {
        addLog('info', 'Running: <b>quality-gatekeeper</b> (fail-closed, threshold: 800)...');
        addLog('success', `- Check readability: passed. Score: 85.`);
        addLog('success', `- Check originality: passed. Score: 95.`);
        addLog('success', `- Check json-ld schema: passed. Score: 100.`);
        addLog('info', `Composite scaled Quality score: <b>${state.scores.quality}/1000</b>.`);
      },
      () => {
        addLog('info', 'Running: <b>seo-auditor</b> (fail-open, threshold: 70)...');
        addLog('success', `- Technical tags, internal links scanned. Score: <b>${state.scores.seo}/100</b>.`);
      },
      () => {
        addLog('info', 'Running: <b>aeo-auditor</b> (fail-open, threshold: 65)...');
        addLog('success', `- JSON-LD structured profiles validated. Score: <b>${state.scores.aeo}/100</b>.`);
      },
      () => {
        addLog('info', 'Running: <b>deployment-guardian</b> (fail-closed, threshold: 80)...');
        addLog('success', `- Rollback validation: OK.`);
        addLog('success', `- Cloudflare config matching: OK. Score: <b>${state.scores.deploy}/100</b>.`);
      },
      () => {
        addLog('info', 'Running: <b>qa-automation</b> (fail-closed, threshold: 70)...');
        addLog('success', `- WCAG layouts & console log scanning complete. Score: <b>${state.scores.qa}/100</b>.`);
      },
      () => {
        // Evaluate Publish rules
        addLog('info', 'Evaluating universal gating guidelines...');
        
        const qScore = state.scores.quality;
        const dScore = state.scores.deploy;
        const qaScore = state.scores.qa;
        
        let hardBlocked = false;
        if (dScore < 80) {
          addLog('error', `CRITICAL VIOLATION: Fail-closed plugin deployment-guardian fell below threshold (Score: ${dScore}/100, Threshold: 80).`);
          hardBlocked = true;
        }
        if (qaScore < 70) {
          addLog('error', `CRITICAL VIOLATION: Fail-closed plugin qa-automation fell below threshold (Score: ${qaScore}/100, Threshold: 70).`);
          hardBlocked = true;
        }
        
        if (hardBlocked || qScore < 700) {
          addLog('error', '<b>PUBLISH GATE REJECTED (Red)</b>. Build failed. Blocked deployment. Emitting emergency notifications.');
          
          // Trigger rollback loop simulation
          addLog('warn', '[Deploy & Recovery Agent] Emergency alert intercepted. Commencing Git repository recovery loop.');
          addLog('system', `[Deploy & Recovery Agent] Rollback target set to commit tag: <b>plugin-layer-v1</b> (hash: 7ad62045).`);
          addLog('system', '[Deploy & Recovery Agent] Git checkout 7ad62045 --force');
          addLog('success', '[Deploy & Recovery Agent] Repository state restored to last stable release. Monitoring indicators stable.');
          
          showToast('error', 'Publish Gate Rejected', 'Rollback triggered to plugin-layer-v1.');
        } else if (qScore < 800) {
          addLog('warn', '<b>PUBLISH GATE NEEDS FIX (Yellow)</b>. Warning logged. Staging deploy allowed. Production deploy BLOCKED.');
          
          // Trigger Content Re-Writer Agent loop
          addLog('warn', '[Content Re-Writer Agent] Gating warnings intercepted. Commencing self-healing prompt logic.');
          addLog('system', '[Content Re-Writer Agent] Analyzing failure signals. Found readability gaps.');
          addLog('system', '[Content Re-Writer Agent] Executing linguistic patch on markdown body tags...');
          addLog('success', '[Content Re-Writer Agent] Readability optimization complete. Created patch commit: <code>4f910a3c</code>.');
          
          // Simulate auto re-run
          setTimeout(() => {
            addLog('info', '[Content Re-Writer Agent] Re-running quality-gatekeeper checks...');
            addLog('success', 'Readability check score improved to 92. Composite score recalculated: <b>845/1000</b>.');
            addLog('success', '<b>PUBLISH GATE PASSED (Green)</b>. Promoting staging to production release <code>plugin-layer-v2</code>.');
            showToast('warning', 'Gate Remediation Success', 'Content Re-Writer auto-patched and promoted deployment.');
            
            // Sync values in state
            state.scores.quality = 845;
            document.getElementById('slider-quality').value = 845;
            document.getElementById('val-quality').innerText = '845 / 1000';
            document.getElementById('gauge-score-text').innerText = 845;
            document.getElementById('gauge-circle').style.strokeDashoffset = 314 * (1 - 0.845);
            
            updateOverviewTable();
          }, 1200);
        } else {
          addLog('success', '<b>PUBLISH GATE PASSED (Green)</b>. Synchronizing production files, creating release tag <b>plugin-layer-v2</b>.');
          showToast('success', 'Publish Success', 'Production release version plugin-layer-v2 deployed.');
        }
        
        runButton.disabled = false;
      }
    ];
    
    // Run step by step
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        steps[currentStep]();
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 600);
  });

  // Security intrusion trigger
  document.getElementById('trigger-violation-btn').addEventListener('click', () => {
    state.governor.violations++;
    document.getElementById('governor-violations-count').innerText = state.governor.violations;
    document.getElementById('governor-violations-count').className = 'value text-red';
    
    // Pulse Red Shield animation
    const shield = document.getElementById('governor-shield-icon');
    shield.className = 'shield-icon-wrapper pulse-red';
    document.getElementById('shield-status-text').innerText = 'SECURITY VIOLATION BLOCKED';
    document.getElementById('shield-status-text').style.color = 'var(--red)';
    
    showToast('error', 'Security Violation Blocked', 'Plugin seo-auditor was blocked from requesting github MCP.');
    
    addLog('error', '<b>SECURITY POLICY BREACH ATTEMPT</b>: Plugin <code>seo-auditor</code> requested dependency: <code>github</code>.');
    addLog('error', 'System Governor blocked request: Unauthorized access vector (not in whitelist). emitted transaction log to EventBus.');
    
    setTimeout(() => {
      shield.className = 'shield-icon-wrapper pulse-blue';
      document.getElementById('shield-status-text').innerText = 'Governor Active & Guarding';
      document.getElementById('shield-status-text').style.color = '';
    }, 5000);
  });
}

// --- Toast notification utility ---
function showToast(type, title, msg) {
  const box = document.getElementById('toast-box');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  if (type === 'error') icon = 'fa-triangle-exclamation';
  if (type === 'info') icon = 'fa-circle-info';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${msg}</p>
    </div>
  `;
  
  box.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}
