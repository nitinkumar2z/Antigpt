// Interactive logic for PDF to Markdown Converter
// Ensure pdf.js is initialized
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
          
          let pageText = '## Page ' + i + '\n\n';
          let lastY = -1;
          
          for (const item of textContent.items) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 12) {
              pageText += '\n';
            }
            pageText += item.str + ' ';
            lastY = item.transform[5];
          }
          markdown += pageText + '\n\n';
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

// Copy clip hook
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

// Download MD hook
document.getElementById('download-btn')?.addEventListener('click', () => {
  const output = document.getElementById('res-value');
  if (output && output.value) {
    const blob = new Blob([output.value], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'extracted_document.md';
    link.click();
  }
});