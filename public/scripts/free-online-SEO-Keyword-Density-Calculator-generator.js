// Interactive logic for Free Online SEO Keyword Density Calculator Generator Calculator
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
});