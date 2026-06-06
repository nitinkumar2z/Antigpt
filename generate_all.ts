import { generateToolAssets } from './src/orchestrator/generator.js';
import * as fs from 'fs';
import * as path from 'path';

const tools = [
  {
    name: 'SEO-Keyword-Density-Calculator-calculator',
    description: 'An automated online tool for free online SEO Keyword Density Calculator generator',
    category: 'Analysis'
  },
  {
    name: 'PDF-to-Markdown-Converter-calculator',
    description: 'An automated online tool for free online PDF to Markdown Converter generator',
    category: 'Analysis'
  },
  {
    name: 'Meta-Tags-Generator-generator',
    description: 'A free online tool to generate optimized SEO Meta Tags and Open Graph data for your website instantly.',
    category: 'SEO'
  },
  {
    name: 'Robots-txt-Generator-generator',
    description: 'A free online tool to quickly build and format standard robots.txt files for search engine crawlers.',
    category: 'SEO'
  },
  {
    name: 'Readability-Score-Calculator-calculator',
    description: 'Calculate the Flesch reading ease score of your text to ensure your content is accessible to a wider audience.',
    category: 'Analysis'
  }
];

function writeFiles() {
  for (const spec of tools) {
    const files = generateToolAssets(spec);
    for (const file of files) {
      const fullPath = path.join(process.cwd(), file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf8');
      console.log(`Generated: ${file.path}`);
    }
  }
}

writeFiles();
console.log('All tools generated with updated SEO schema!');
