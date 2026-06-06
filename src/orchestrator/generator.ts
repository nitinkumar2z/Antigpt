/**
 * @fileoverview AST / Template-based Tool Generation Engine.
 * @module orchestrator/generator
 */

import type { ToolSpecification, GeneratedFile } from './types.js';

/**
 * Compiles a ToolSpecification into functional HTML/JS/CSS source code files.
 */
export function generateToolAssets(spec: ToolSpecification): GeneratedFile[] {
  const toolName = spec.name;
  const toolTitle = toolName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const isGenerator = toolName.toLowerCase().includes('generator') || toolName.toLowerCase().includes('builder');
  const isCalculator = toolName.toLowerCase().includes('calculator') || toolName.toLowerCase().includes('score') || toolName.toLowerCase().includes('estimator');
  
  // 1. Generate Custom Stylesheet
  const cssContent = `/* Premium Stylesheet for ${toolTitle} */
:root {
  --bg-dark: #0a0e17;
  --panel-bg: rgba(18, 26, 44, 0.65);
  --primary-glow: #3b82f6;
  --secondary-glow: #10b981;
  --border-color: rgba(255, 255, 255, 0.08);
  --text-primary: #f3f4f6;
  --text-muted: #9ca3af;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-primary);
  font-family: 'Outfit', sans-serif;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.tool-card {
  background: var(--panel-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 2.5rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 50px rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.3);
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
}

.description {
  color: var(--text-muted);
  text-align: center;
  font-size: 0.95rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.input-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

input[type="text"], input[type="number"], select, textarea {
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-primary);
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary-glow);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.25);
}

.action-btn {
  width: 100%;
  padding: 1rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #10b981);
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  transition: all 0.2s;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.action-btn:active {
  transform: translateY(1px);
}

.results-panel {
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px dashed var(--border-color);
  display: none;
  animation: fadeIn 0.4s ease-out forwards;
}

.result-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.result-row:last-child {
  margin-bottom: 0;
}

.result-label {
  color: var(--text-muted);
}

.result-value {
  font-weight: 600;
  color: var(--secondary-glow);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  // 2. Generate Interactive Client Javascript
  let jsContent = '';
  if (isCalculator) {
    jsContent = `// Interactive logic for ${toolTitle} Calculator
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const valA = parseFloat(document.getElementById('param-a')?.value || '0');
  const valB = parseFloat(document.getElementById('param-b')?.value || '1');
  const operation = document.getElementById('calc-op')?.value || 'multiply';
  
  let result = 0;
  if (operation === 'add') result = valA + valB;
  else if (operation === 'subtract') result = valA - valB;
  else if (operation === 'divide') result = valB !== 0 ? valA / valB : 0;
  else result = valA * valB; // multiply default

  // Display results Panel
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  
  if (panel && output) {
    output.innerText = result.toLocaleString(undefined, { maximumFractionDigits: 4 });
    panel.style.display = 'block';
  }
});`;
  } else if (isGenerator) {
    jsContent = `// Dynamic Builder logic for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const textInput = document.getElementById('text-val')?.value || '';
  const modifier = document.getElementById('select-mod')?.value || 'uppercase';
  
  let generated = '';
  if (modifier === 'lowercase') generated = textInput.toLowerCase();
  else if (modifier === 'slugify') generated = textInput.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  else generated = textInput.toUpperCase();

  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  
  if (panel && output) {
    output.value = generated;
    panel.style.display = 'block';
  }
});

// Copy clip hook
document.getElementById('copy-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output) {
    navigator.clipboard.writeText(output.value);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = '';
      }, 1500);
    }
  }
});`;
  } else {
    // Default generic tool
    jsContent = `// Generic functional code for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('input-param')?.value || '';
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  if (panel && output) {
    output.innerText = 'Processed value: ' + input;
    panel.style.display = 'block';
  }
});`;
  }

  // 3. Generate Astro Page wrapping the Layout
  let bodyHtml = '';
  if (isCalculator) {
    bodyHtml = `<div class="tool-card">
  <h1>${toolTitle}</h1>
  <p class="description">${spec.description}</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="param-a">First Parameter Value</label>
      <input type="number" id="param-a" placeholder="e.g. 150" required step="any" />
    </div>
    
    <div class="input-group">
      <label for="calc-op">Calculation Type</label>
      <select id="calc-op">
        <option value="multiply">Multiply (*)</option>
        <option value="add">Add (+)</option>
        <option value="subtract">Subtract (-)</option>
        <option value="divide">Divide (/)</option>
      </select>
    </div>
    
    <div class="input-group">
      <label for="param-b">Second Parameter Value</label>
      <input type="number" id="param-b" placeholder="e.g. 5" required step="any" />
    </div>
    
    <button type="submit" class="action-btn">Calculate Score</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <div class="result-row">
      <span class="result-label">Computed Result:</span>
      <span id="res-value" class="result-value">-</span>
    </div>
  </div>
</div>`;
  } else if (isGenerator) {
    bodyHtml = `<div class="tool-card">
  <h1>${toolTitle}</h1>
  <p class="description">${spec.description}</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="text-val">Input Source Text</label>
      <textarea id="text-val" rows="4" placeholder="Enter keywords or text to format..." required></textarea>
    </div>
    
    <div class="input-group">
      <label for="select-mod">Format / Rule</label>
      <select id="select-mod">
        <option value="uppercase">UPPERCASE</option>
        <option value="lowercase">lowercase</option>
        <option value="slugify">slugify-url-format</option>
      </select>
    </div>
    
    <button type="submit" class="action-btn">Generate Content</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <label>Generated Output</label>
    <textarea id="res-value" readonly rows="3" style="background: rgba(0,0,0,0.5); font-family: monospace;"></textarea>
    <button id="copy-btn" class="action-btn" style="margin-top: 1rem; background: var(--primary-glow);">Copy to Clipboard</button>
  </div>
</div>`;
  } else {
    // Generic
    bodyHtml = `<div class="tool-card">
  <h1>${toolTitle}</h1>
  <p class="description">${spec.description}</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="input-param">Enter string parameter:</label>
      <input type="text" id="input-param" placeholder="Input variables..." required />
    </div>
    
    <button type="submit" class="action-btn">Process</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <div class="result-row">
      <span class="result-label">Result:</span>
      <span id="res-value" class="result-value">-</span>
    </div>
  </div>
</div>`;
  }

  const astroContent = `---
// Programmatically generated page for ${toolTitle} by ANTIGPT
title: "${toolTitle} - Free Online Tool"
description: "${spec.description}"
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${toolTitle} - Online Tool</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/${spec.name}.css" />
</head>
<body>
  ${bodyHtml}
  <script src="/scripts/${spec.name}.js" defer></script>
</body>
</html>
`;

  return [
    {
      path: `src/pages/tools/${spec.name}.astro`,
      content: astroContent,
    },
    {
      path: `public/scripts/${spec.name}.js`,
      content: jsContent,
    },
    {
      path: `public/styles/${spec.name}.css`,
      content: cssContent,
    },
  ];
}
