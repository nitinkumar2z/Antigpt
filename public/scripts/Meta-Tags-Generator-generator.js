// Dynamic Builder logic for Meta Tags Generator Generator
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
});