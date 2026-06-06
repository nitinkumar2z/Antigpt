import * as fs from 'fs';
import * as path from 'path';
import { buildingTypes } from '../src/orchestrator/buildingTypes.js';

const DIST_DIR = path.resolve(process.cwd(), 'dist_html');
const TOOLS_DIR = path.resolve(DIST_DIR, 'tools');
const ESTIMATOR_DIR = path.resolve(TOOLS_DIR, 'compliance-patent-cost-estimator-by-building-type');

// Ensure directories exist
if (!fs.existsSync(ESTIMATOR_DIR)) {
  fs.mkdirSync(ESTIMATOR_DIR, { recursive: true });
}

// Helper to compile the links grid HTML
function getLinksGridHtml() {
  return buildingTypes.map((type) => {
    return `<a class="programmatic-link" href="/tools/compliance-patent-cost-estimator-by-building-type/${type.slug}.html" title="Patent Cost for ${type.name}">${type.name}</a>`;
  }).join('\n        ');
}

// Compile the main landing page (homepage)
function compileHomepage() {
  const srcPath = path.resolve(process.cwd(), 'src/pages/index.astro');
  let content = fs.readFileSync(srcPath, 'utf-8');

  // Strip frontmatter
  content = content.replace(/^---[\s\S]*?---/, '');

  const destPath = path.resolve(DIST_DIR, 'index.html');
  fs.writeFileSync(destPath, content, 'utf-8');
  console.log(`Compiled homepage to: ${destPath}`);
}

// Compile the main page
function compileMainPage() {
  const srcPath = path.resolve(process.cwd(), 'src/pages/tools/compliance-patent-cost-estimator-by-building-type.astro');
  let content = fs.readFileSync(srcPath, 'utf-8');

  // Strip frontmatter
  content = content.replace(/^---[\s\S]*?---/, '');

  // Evaluate constants and props
  const title = "Compliance Patent Cost Estimator by Building Type - Free Online Tool";
  const description = "Calculate and breakdown patent filing, legal, and maintenance compliance costs across US, EU, and global regions for various building and facility types.";
  
  content = content.replace(/{title}/g, title);
  content = content.replace(/{description}/g, description);
  
  // Replace the dynamic map of building types select options
  const selectOptionsHtml = buildingTypes.map((t) => {
    return `<option value="${t.slug}">${t.name}</option>`;
  }).join('\n              ');
  content = content.replace(/{buildingTypes\.map\(\(type\) => \([\s\S]*?\}\)/g, selectOptionsHtml);

  // Replace the link wall grid
  content = content.replace(/{buildingTypes\.map\(\(type\) => \([\s\S]*?\}\)/g, getLinksGridHtml());

  const destPath = path.resolve(TOOLS_DIR, 'compliance-patent-cost-estimator-by-building-type.html');
  fs.writeFileSync(destPath, content, 'utf-8');
  console.log(`Compiled main page to: ${destPath}`);
}

// Compile the 105 subpages
function compileSubpages() {
  const srcPath = path.resolve(process.cwd(), 'src/pages/tools/compliance-patent-cost-estimator-by-building-type/[slug].astro');
  const template = fs.readFileSync(srcPath, 'utf-8');

  // Strip frontmatter
  const htmlTemplate = template.replace(/^---[\s\S]*?---/, '');

  for (const type of buildingTypes) {
    let content = htmlTemplate;

    // Define replacement variables
    const title = `${type.name} Patent Cost Estimator — Compliance Costs Calculator`;
    const description = `Estimate filing, drafting, and maintenance patent compliance costs for ${type.name} facilities. Learn about key filing challenges like: ${type.filingChallenge}`;
    const keywords = `${type.name.toLowerCase()} patent, ${type.name.toLowerCase()} compliance, patent cost estimator, construction IP`;

    // Dynamic replacement
    content = content.replace(/{title}/g, title);
    content = content.replace(/{description}/g, description);
    content = content.replace(/{keywords}/g, keywords);
    
    content = content.replace(/{type\.name}/g, type.name);
    content = content.replace(/{type\.slug}/g, type.slug);
    content = content.replace(/{type\.description}/g, type.description);
    content = content.replace(/{type\.basePatentVolume}/g, String(type.basePatentVolume));
    content = content.replace(/{type\.filingChallenge}/g, type.filingChallenge);
    content = content.replace(/{type\.faqQuestion}/g, type.faqQuestion);
    content = content.replace(/{type\.faqAnswer}/g, type.faqAnswer);
    content = content.replace(/{type\.complexity}/g, String(type.complexity));

    // Dynamic select options
    const selectOptionsHtml = buildingTypes.map((bt) => {
      const selected = bt.slug === type.slug ? ' selected' : '';
      return `<option value="${bt.slug}"${selected}>${bt.name}</option>`;
    }).join('\n              ');
    content = content.replace(/{buildingTypes\.map\(\(bt\) => \([\s\S]*?\}\)/, selectOptionsHtml);

    // Link wall grid
    content = content.replace(/{buildingTypes\.map\(\(bt\) => \([\s\S]*?\}\)/g, getLinksGridHtml());

    // Clean up dynamic Astro template literals for static HTML
    content = content.replace(/(href|content)={\\?[\`']([^'\`}]+)\\?[\`']}/g, (match, attr, url) => {
      const cleanUrl = url.replace('$', '').replace('\\', '');
      return `${attr}="${cleanUrl}"`;
    });

    const destPath = path.resolve(ESTIMATOR_DIR, `${type.slug}.html`);
    fs.writeFileSync(destPath, content, 'utf-8');
  }

  console.log(`Compiled ${buildingTypes.length} programmatic subpages to: ${ESTIMATOR_DIR}/`);
}

// Compile styles and scripts (copy them from public/ to dist_html/)
function compileAssets() {
  const assets = [
    { src: 'public/styles/compliance-patent-cost-estimator-by-building-type.css', dest: 'dist_html/styles/compliance-patent-cost-estimator-by-building-type.css' },
    { src: 'public/scripts/compliance-patent-cost-estimator-by-building-type.js', dest: 'dist_html/scripts/compliance-patent-cost-estimator-by-building-type.js' }
  ];

  for (const asset of assets) {
    const src = path.resolve(process.cwd(), asset.src);
    const dest = path.resolve(process.cwd(), asset.dest);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied asset: ${asset.src} -> ${asset.dest}`);
  }
}

// Generate sitemap.xml and robots.txt
function generateSeoFiles() {
  const BASE_URL = 'https://t20tycoon.com';
  
  // 1. Robots.txt
  const robotsContent = `User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.resolve(DIST_DIR, 'robots.txt'), robotsContent, 'utf-8');
  console.log('Generated robots.txt');

  // 2. Sitemap.xml
  const urls = [
    '',
    '/tools/compliance-patent-cost-estimator-by-building-type.html',
  ];
  
  // Add other tools in tools/
  const tools = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.html') && f !== 'compliance-patent-cost-estimator-by-building-type.html');
  for (const tool of tools) {
    urls.push(`/tools/${tool}`);
  }

  // Add the 105 programmatic subpages
  for (const type of buildingTypes) {
    urls.push(`/tools/compliance-patent-cost-estimator-by-building-type/${type.slug}.html`);
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${BASE_URL}${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === '' ? '1.0' : url.includes('compliance-patent-cost-estimator') && !url.includes('[slug]') ? '0.9' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.resolve(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log('Generated sitemap.xml');
}

compileHomepage();
compileMainPage();
compileSubpages();
compileAssets();
generateSeoFiles();
console.log('Static site compilation completed successfully!');

