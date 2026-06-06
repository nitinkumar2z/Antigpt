/**
 * @fileoverview AST / Template-based Tool Generation Engine with specialized tool support.
 * @module orchestrator/generator
 */

import type { ToolSpecification, GeneratedFile } from './types.js';

/**
 * Compiles a ToolSpecification into functional HTML/JS/CSS source code files.
 */
export function generateToolAssets(spec: ToolSpecification): GeneratedFile[] {
  const toolName = spec.name;
  const toolTitle = toolName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  // Detect tool niches
  const isPdf = toolName.toLowerCase().includes('pdf');
  const isDensity = toolName.toLowerCase().includes('density');
  const isGenerator = toolName.toLowerCase().includes('generator') || toolName.toLowerCase().includes('builder');
  const isCalculator = toolName.toLowerCase().includes('calculator') || toolName.toLowerCase().includes('score') || toolName.toLowerCase().includes('estimator');
  
  // New Niche Detections
  const isSchema = toolName.toLowerCase().includes('schema') || toolName.toLowerCase().includes('jsonld') || toolName.toLowerCase().includes('faq');
  const isConverter = toolName.toLowerCase().includes('converter') || toolName.toLowerCase().includes('px') || toolName.toLowerCase().includes('case') || toolName.toLowerCase().includes('format') || toolName.toLowerCase().includes('markdown');
  const isCounter = toolName.toLowerCase().includes('counter') || toolName.toLowerCase().includes('word') || toolName.toLowerCase().includes('character');
  const isSecure = toolName.toLowerCase().includes('password') || toolName.toLowerCase().includes('uuid') || toolName.toLowerCase().includes('hash') || toolName.toLowerCase().includes('secure');
  const isColor = toolName.toLowerCase().includes('color') || toolName.toLowerCase().includes('palette') || toolName.toLowerCase().includes('hex');

  // Determine width based on type
  let maxWidth = '500px';
  if (isDensity || isPdf || isSchema || isCounter) {
    maxWidth = '650px';
  } else if (isConverter) {
    maxWidth = '600px';
  }
  
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
  --success: #10b981;
  --warning: #f59e0b;
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
  max-width: ${maxWidth};
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

input[type="text"], input[type="number"], input[type="color"], select, textarea {
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

.secondary-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-color);
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: none;
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

.counter-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.counter-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
}

.counter-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-glow);
}

.palette-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  // 2. Generate Interactive Client Javascript
  let jsContent = '';
  if (isPdf) {
    jsContent = `// Interactive logic for PDF to Markdown Converter
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

document.getElementById('tool-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('pdf-file');
  const file = fileInput.files?.[0];
  if (!file) return;
  const statusMsg = document.getElementById('status-message');
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  
  if (statusMsg && panel) {
    statusMsg.innerText = 'Initializing conversion...';
    statusMsg.style.display = 'block';
    panel.style.display = 'block';
  }
  
  try {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument(typedarray);
        loadingTask.onProgress = function(progress) {
          const pct = (progress.loaded / progress.total) * 100;
          if (statusMsg) statusMsg.innerText = 'Loading PDF: ' + pct.toFixed(0) + '%';
        };
        const pdf = await loadingTask.promise;
        let markdown = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          if (statusMsg) statusMsg.innerText = 'Converting Page ' + i + ' of ' + pdf.numPages + '...';
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          let pageText = '## Page ' + i + '\\n\\n';
          let lastY = -1;
          for (const item of textContent.items) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 12) {
              pageText += '\\n';
            }
            pageText += item.str + ' ';
            lastY = item.transform[5];
          }
          markdown += pageText + '\\n\\n';
        }
        if (output) output.value = markdown;
        if (statusMsg) statusMsg.innerText = 'Conversion Complete!';
      } catch (err) {
        if (statusMsg) statusMsg.innerText = 'Error parsing PDF: ' + err.message;
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    if (statusMsg) statusMsg.innerText = 'Error: ' + err.message;
  }
});

document.getElementById('copy-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output) {
    navigator.clipboard.writeText(output.value);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => btn.innerText = originalText, 1500);
    }
  }
});

document.getElementById('download-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output && output.value) {
    const blob = new Blob([output.value], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'extracted_document.md';
    link.click();
  }
});`;
  } else if (isDensity) {
    jsContent = `// Interactive keyword density logic for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('text-content')?.value || '';
  const targetKeyword = document.getElementById('target-keyword')?.value.trim().toLowerCase() || '';
  const words = text.toLowerCase().replace(/[.,\\/#!$%\\^&\\*;:{}=\\-_~()?\"'\\n\\r]/g, " ").split(/\\s+/).filter(w => w.length > 1);
  const totalCount = words.length;
  const countOutput = document.getElementById('word-count-val');
  if (countOutput) countOutput.innerText = totalCount;
  
  const stopWords = new Set(['the', 'a', 'and', 'is', 'of', 'to', 'in', 'it', 'for', 'on', 'with', 'as', 'this', 'that', 'by', 'at', 'an', 'be', 'are', 'from', 'or', 'your', 'my']);
  const frequencyMap = {};
  words.forEach(word => {
    if (!stopWords.has(word)) {
      frequencyMap[word] = (frequencyMap[word] || 0) + 1;
    }
  });
  
  const targetRow = document.getElementById('target-density-row');
  const targetVal = document.getElementById('target-density-val');
  if (targetKeyword && targetRow && targetVal) {
    let targetCount = 0;
    if (targetKeyword.split(/\\s+/).length > 1) {
      let pos = 0;
      const cleanText = text.toLowerCase();
      while ((pos = cleanText.indexOf(targetKeyword, pos)) !== -1) {
        targetCount++;
        pos += targetKeyword.length;
      }
    } else {
      targetCount = words.filter(w => w === targetKeyword).length;
    }
    const densityPercent = totalCount > 0 ? (targetCount / totalCount) * 100 : 0;
    targetVal.innerText = targetCount + ' occurrences (' + densityPercent.toFixed(2) + '%)';
    targetRow.style.display = 'flex';
  } else if (targetRow) {
    targetRow.style.display = 'none';
  }
  
  const sortedKeywords = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tableContainer = document.getElementById('density-table');
  if (tableContainer) {
    tableContainer.innerHTML = '';
    if (sortedKeywords.length === 0) {
      tableContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No keywords analyzed yet.</div>';
    } else {
      sortedKeywords.forEach(([kw, count]) => {
        const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justify = 'space-between';
        row.style.background = 'rgba(255, 255, 255, 0.03)';
        row.style.padding = '0.5rem 0.75rem';
        row.style.borderRadius = '6px';
        row.style.fontSize = '0.9rem';
        row.innerHTML = '<strong>' + kw + '</strong><span>' + count + ' times (' + pct.toFixed(2) + '%)</span>';
        tableContainer.appendChild(row);
      });
    }
  }
  const panel = document.getElementById('results-box');
  if (panel) panel.style.display = 'block';
});`;
  } else if (isSchema) {
    jsContent = `// Schema generator logic for ${toolTitle}
document.getElementById('add-faq-btn')?.addEventListener('click', () => {
  const container = document.getElementById('faq-inputs');
  if (!container) return;
  const index = container.children.length + 1;
  const group = document.createElement('div');
  group.className = 'input-group faq-group';
  group.style.borderTop = '1px solid var(--border-color)';
  group.style.paddingTop = '1rem';
  group.style.marginTop = '1rem';
  group.innerHTML = \`
    <label>Question \${index}</label>
    <input type="text" class="faq-q" placeholder="Enter question..." style="margin-bottom: 0.5rem;" />
    <label>Answer \${index}</label>
    <textarea class="faq-a" rows="2" placeholder="Enter answer..."></textarea>
  \`;
  container.appendChild(group);
});

document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const qs = document.querySelectorAll('.faq-q');
  const as = document.querySelectorAll('.faq-a');
  const faqs = [];
  for (let i = 0; i < qs.length; i++) {
    const qVal = qs[i].value.trim();
    const aVal = as[i]?.value.trim();
    if (qVal && aVal) {
      faqs.push({
        "@type": "Question",
        "name": qVal,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": aVal
        }
      });
    }
  }
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs
  };
  
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  if (panel && output) {
    output.value = JSON.stringify(schema, null, 2);
    panel.style.display = 'block';
  }
});

document.getElementById('copy-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output) {
    navigator.clipboard.writeText(output.value);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => btn.innerText = originalText, 1500);
    }
  }
});`;
  } else if (isConverter) {
    jsContent = `// Converter logic for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const inputVal = document.getElementById('convert-input')?.value || '';
  const type = document.getElementById('convert-type')?.value || 'px2rem';
  let result = '';
  
  if (type === 'px2rem') {
    const px = parseFloat(inputVal);
    result = isNaN(px) ? 'Invalid Input' : (px / 16) + 'rem';
  } else if (type === 'rem2px') {
    const rem = parseFloat(inputVal);
    result = isNaN(rem) ? 'Invalid Input' : (rem * 16) + 'px';
  } else if (type === 'markdown2html') {
    result = inputVal
      .replace(/### (.*?)\\n/g, '<h3>$1</h3>')
      .replace(/## (.*?)\\n/g, '<h2>$1</h2>')
      .replace(/# (.*?)\\n/g, '<h1>$1</h1>')
      .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
      .replace(/\\n/g, '<br/>');
  } else if (type === 'jsonformat') {
    try {
      result = JSON.stringify(JSON.parse(inputVal), null, 2);
    } catch (err) {
      result = 'Invalid JSON: ' + err.message;
    }
  }
  
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  if (panel && output) {
    output.value = result;
    panel.style.display = 'block';
  }
});

document.getElementById('copy-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output) {
    navigator.clipboard.writeText(output.value);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => btn.innerText = originalText, 1500);
    }
  }
});`;
  } else if (isCounter) {
    jsContent = `// Counter logic for ${toolTitle}
const textarea = document.getElementById('counter-textarea');
const updateCounts = () => {
  const text = textarea?.value || '';
  const charCount = text.length;
  const words = text.trim() === '' ? [] : text.trim().split(/\\s+/);
  const wordCount = words.length;
  const sentenceCount = text.trim() === '' ? 0 : text.split(/[.!?]+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 225);
  
  const charsVal = document.getElementById('chars-val');
  const wordsVal = document.getElementById('words-val');
  const sentencesVal = document.getElementById('sentences-val');
  const readingVal = document.getElementById('reading-val');
  
  if (charsVal) charsVal.innerText = charCount;
  if (wordsVal) wordsVal.innerText = wordCount;
  if (sentencesVal) sentencesVal.innerText = sentenceCount;
  if (readingVal) readingVal.innerText = readingTime + ' min';
};

textarea?.addEventListener('input', updateCounts);

document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  updateCounts();
  const panel = document.getElementById('results-box');
  if (panel) panel.style.display = 'block';
});`;
  } else if (isSecure) {
    jsContent = `// Security generator logic for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const mode = document.getElementById('secure-mode')?.value || 'uuid';
  let result = '';
  
  if (mode === 'uuid') {
    result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } else {
    const len = parseInt(document.getElementById('pass-len')?.value || '16', 10);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,./-=';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  if (panel && output) {
    output.value = result;
    panel.style.display = 'block';
  }
});

document.getElementById('copy-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output) {
    navigator.clipboard.writeText(output.value);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => btn.innerText = originalText, 1500);
    }
  }
});`;
  } else if (isColor) {
    jsContent = `// Color palette and conversion logic for ${toolTitle}
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const baseColor = document.getElementById('base-color')?.value || '#3b82f6';
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const rgbStr = 'rgb(' + r + ', ' + g + ', ' + b + ')';
  
  const palette = [
    baseColor,
    'rgba(' + r + ', ' + g + ', ' + b + ', 0.8)',
    'rgba(' + r + ', ' + g + ', ' + b + ', 0.6)',
    'rgba(' + r + ', ' + g + ', ' + b + ', 0.4)',
    'rgba(' + r + ', ' + g + ', ' + b + ', 0.2)'
  ];
  
  const list = document.getElementById('palette-list');
  if (list) {
    list.innerHTML = '';
    palette.forEach(color => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '1rem';
      item.style.marginBottom = '0.5rem';
      item.style.cursor = 'pointer';
      item.innerHTML = '<div style="width: 40px; height: 40px; border-radius: 8px; background: ' + color + '; border: 1px solid var(--border-color);"></div><span style="font-family: monospace; font-size: 0.9rem;">' + color + '</span>';
      item.addEventListener('click', () => {
        navigator.clipboard.writeText(color);
        alert('Copied color: ' + color);
      });
      list.appendChild(item);
    });
  }
  
  const panel = document.getElementById('results-box');
  const output = document.getElementById('res-value');
  if (panel && output) {
    output.value = baseColor + ' | ' + rgbStr;
    panel.style.display = 'block';
  }
});`;
  } else if (isCalculator) {
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
  else result = valA * valB;
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
  if (isPdf) {
    bodyHtml = `<div class="tool-card">
  <h1>PDF to Markdown Converter</h1>
  <p class="description">Select a PDF document to extract its full text content and convert it into clean formatted Markdown code instantaneously.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="pdf-file">Choose PDF File</label>
      <input type="file" id="pdf-file" accept=".pdf" required style="padding: 0.5rem;" />
    </div>
    <button type="submit" class="action-btn">Convert to Markdown</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <div id="status-message" style="color: var(--secondary-glow); margin-bottom: 1rem; font-size: 0.9rem; text-align: center; display: none;">Converting...</div>
    <label>Converted Markdown Output</label>
    <textarea id="res-value" readonly rows="8" style="background: rgba(0,0,0,0.5); font-family: monospace;"></textarea>
    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
      <button id="copy-btn" class="action-btn" style="background: var(--primary-glow); flex: 1;">Copy to Clipboard</button>
      <button id="download-btn" class="action-btn" style="background: var(--secondary-glow); flex: 1;">Download .md</button>
    </div>
  </div>
</div>`;
  } else if (isDensity) {
    bodyHtml = `<div class="tool-card">
  <h1>SEO Keyword Density Calculator</h1>
  <p class="description">Paste your content to analyze keyword distribution ratios, word counts, and optimization density percentages instantly.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="text-content">Paste Article / Body Copy</label>
      <textarea id="text-content" rows="6" placeholder="Paste your article content here to analyze keyword densities..." required></textarea>
    </div>
    
    <div class="input-group">
      <label for="target-keyword">Target Focus Keyword (Optional)</label>
      <input type="text" id="target-keyword" placeholder="e.g. search engine optimization" />
    </div>
    <button type="submit" class="action-btn">Analyze Density</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <div class="result-row" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
      <span class="result-label">Total Words Count:</span>
      <span id="word-count-val" class="result-value" style="font-size: 1.1rem; color: var(--primary-glow);">-</span>
    </div>
    
    <div id="target-density-row" class="result-row" style="display: none; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
      <span class="result-label">Target Focus Keyword Density:</span>
      <span id="target-density-val" class="result-value" style="font-size: 1.1rem; color: var(--secondary-glow);">-</span>
    </div>
    
    <label style="margin-bottom: 0.75rem;">Top Density Frequency Distribution</label>
    <div id="density-table" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
      <!-- Populated via Javascript -->
    </div>
  </div>
</div>`;
  } else if (isSchema) {
    bodyHtml = `<div class="tool-card">
  <h1>JSON-LD FAQ Schema Generator</h1>
  <p class="description">Easily create structured FAQ schema snippets to improve search result rich snippets and semantic AEO parseability.</p>
  
  <form id="tool-form">
    <div id="faq-inputs">
      <div class="input-group faq-group">
        <label>Question 1</label>
        <input type="text" class="faq-q" placeholder="What is ANTIGPT?" required style="margin-bottom: 0.5rem;" />
        <label>Answer 1</label>
        <textarea class="faq-a" rows="2" placeholder="It is an autonomous agentic framework." required></textarea>
      </div>
    </div>
    
    <div style="display: flex; gap: 1rem; margin: 1.5rem 0;">
      <button type="button" id="add-faq-btn" class="action-btn secondary-btn" style="flex: 1;">+ Add FAQ Item</button>
      <button type="submit" class="action-btn" style="flex: 1;">Generate Schema</button>
    </div>
  </form>
  
  <div id="results-box" class="results-panel">
    <label>JSON-LD Code Output</label>
    <textarea id="res-value" readonly rows="8" style="background: rgba(0,0,0,0.5); font-family: monospace;"></textarea>
    <button id="copy-btn" class="action-btn" style="margin-top: 1rem; background: var(--primary-glow);">Copy Schema</button>
  </div>
</div>`;
  } else if (isConverter) {
    bodyHtml = `<div class="tool-card">
  <h1>PX to REM & Markdown HTML Converter</h1>
  <p class="description">Convert sizes between px and rem, format markdown content to clean HTML, or prettify JSON payloads.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="convert-type">Conversion Type</label>
      <select id="convert-type">
        <option value="px2rem">PX to REM (base 16px)</option>
        <option value="rem2px">REM to PX (base 16px)</option>
        <option value="markdown2html">Markdown to Raw HTML</option>
        <option value="jsonformat">Prettify JSON Payload</option>
      </select>
    </div>
    
    <div class="input-group">
      <label for="convert-input">Input Value / Code</label>
      <textarea id="convert-input" rows="5" placeholder="Enter number, markdown, or JSON string..." required></textarea>
    </div>
    <button type="submit" class="action-btn">Convert / Format</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <label>Conversion Output</label>
    <textarea id="res-value" readonly rows="6" style="background: rgba(0,0,0,0.5); font-family: monospace;"></textarea>
    <button id="copy-btn" class="action-btn" style="margin-top: 1rem; background: var(--primary-glow);">Copy Output</button>
  </div>
</div>`;
  } else if (isCounter) {
    bodyHtml = `<div class="tool-card">
  <h1>Character & Word Counter</h1>
  <p class="description">Analyze your copywriting length, sentence structure, and estimate reading time dynamically as you type.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="counter-textarea">Write or Paste Text</label>
      <textarea id="counter-textarea" rows="7" placeholder="Type or paste some text here to count..." required></textarea>
    </div>
    <button type="submit" class="action-btn">Analyze Text</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <div class="counter-grid">
      <div class="counter-box">
        <div id="chars-val" class="counter-number">0</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Characters</div>
      </div>
      <div class="counter-box">
        <div id="words-val" class="counter-number">0</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Words</div>
      </div>
      <div class="counter-box">
        <div id="sentences-val" class="counter-number">0</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Sentences</div>
      </div>
      <div class="counter-box">
        <div id="reading-val" class="counter-number">0 min</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Reading Time</div>
      </div>
    </div>
  </div>
</div>`;
  } else if (isSecure) {
    bodyHtml = `<div class="tool-card">
  <h1>Secure Password & UUID Generator</h1>
  <p class="description">Instantly generate cryptographically secure UUID v4 strings or high-entropy random passwords.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="secure-mode">Generation Type</label>
      <select id="secure-mode">
        <option value="uuid">UUID v4 Identifier</option>
        <option value="password">Secure Random Password</option>
      </select>
    </div>
    
    <div class="input-group">
      <label for="pass-len">Password Length (Characters)</label>
      <input type="number" id="pass-len" min="8" max="64" value="16" />
    </div>
    <button type="submit" class="action-btn">Generate Secure Value</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <label>Generated Secure Value</label>
    <textarea id="res-value" readonly rows="2" style="background: rgba(0,0,0,0.5); font-family: monospace; font-size: 1.1rem; text-align: center; color: var(--secondary-glow);"></textarea>
    <button id="copy-btn" class="action-btn" style="margin-top: 1rem; background: var(--primary-glow);">Copy Secure Value</button>
  </div>
</div>`;
  } else if (isColor) {
    bodyHtml = `<div class="tool-card">
  <h1>Color Palette Generator</h1>
  <p class="description">Select a primary color to inspect RGB hex conversions and generate a sleek dark/light opacity palette scale.</p>
  
  <form id="tool-form">
    <div class="input-group">
      <label for="base-color">Select Primary Color</label>
      <input type="color" id="base-color" value="#3b82f6" style="height: 50px; cursor: pointer;" />
    </div>
    <button type="submit" class="action-btn">Generate Palette</button>
  </form>
  
  <div id="results-box" class="results-panel">
    <label>HEX and RGB Conversions</label>
    <input type="text" id="res-value" readonly style="font-family: monospace; text-align: center; color: var(--secondary-glow); margin-bottom: 1rem;" />
    <label>Interactive Palette (Click to Copy)</label>
    <div id="palette-list" class="palette-container"></div>
  </div>
</div>`;
  } else if (isCalculator) {
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
// Programmatically generated page for \${toolTitle} by ANTIGPT
title: "\${toolTitle} - Free Online Tool"
description: "\${spec.description}"
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\${toolTitle} - Free Online Tool</title>
  <meta name="description" content="\${spec.description}" />
  <meta name="keywords" content="\${toolName.replace(/-/g, ', ')}, online tool, free generator, antigpt" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://t20tycoon.com/tools/\${spec.name}.html" />
  
  <!-- Required Verification & Tracking Scripts -->
  <meta name="google-site-verification" content="google-verification-hash-123456789" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXX');
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123456789" crossorigin="anonymous"></script>

  <!-- Open Graph -->
  <meta property="og:title" content="\${toolTitle} - Free Online Tool" />
  <meta property="og:description" content="\${spec.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://t20tycoon.com/tools/\${spec.name}.html" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="\${toolTitle} - Free Online Tool" />
  <meta name="twitter:description" content="\${spec.description}" />

  <!-- Fonts & Styles -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/\${spec.name}.css" />

  <!-- Structured Data JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "\${toolTitle}",
    "description": "\${spec.description}",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  }
  </script>
</head>
<body>
  ${bodyHtml}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
  <script src="/scripts/\${spec.name}.js" defer></script>
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
