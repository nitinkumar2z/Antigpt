// Interactive keyword density logic for SEO Keyword Density Calculator Calculator
document.getElementById('tool-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const text = document.getElementById('text-content')?.value || '';
  const targetKeyword = document.getElementById('target-keyword')?.value.trim().toLowerCase() || '';
  
  // Clean and split words
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_~()?"'\n\r]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);
    
  const totalCount = words.length;
  const countOutput = document.getElementById('word-count-val');
  if (countOutput) {
    countOutput.innerText = totalCount;
  }
  
  // Exclude common stop words
  const stopWords = new Set([
    'the', 'a', 'and', 'is', 'of', 'to', 'in', 'it', 'for', 'on', 'with', 
    'as', 'this', 'that', 'by', 'at', 'an', 'be', 'are', 'from', 'or', 'your', 'my'
  ]);
  
  const frequencyMap = {};
  words.forEach(word => {
    if (!stopWords.has(word)) {
      frequencyMap[word] = (frequencyMap[word] || 0) + 1;
    }
  });
  
  // Analyze Target Keyword density if provided
  const targetRow = document.getElementById('target-density-row');
  const targetVal = document.getElementById('target-density-val');
  if (targetKeyword && targetRow && targetVal) {
    let targetCount = 0;
    if (targetKeyword.split(/\s+/).length > 1) {
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
  
  // Populate top keywords table
  const sortedKeywords = Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
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
  if (panel) {
    panel.style.display = 'block';
  }
});