const fs = require('fs');
const path = require('path');

const skills = [
  { id: 'tool-research', name: 'ToolResearchSkill', desc: 'Search demand, competition analysis, monetization analysis, trend analysis, opportunity scoring.' },
  { id: 'keyword-intent', name: 'KeywordIntentSkill', desc: 'Intent classification, SERP intent mapping, search journey mapping, commercial intent scoring.' },
  { id: 'competitor-analysis', name: 'CompetitorAnalysisSkill', desc: 'Competitor discovery, content gap analysis, weakness detection, authority comparison.' },
  { id: 'programmatic-seo', name: 'ProgrammaticSEOSkill', desc: 'Page template generation, internal linking plans, topical clustering, entity mapping.' },
  { id: 'content-quality', name: 'ContentQualitySkill', desc: 'EEAT validation, readability scoring, helpful content scoring, AI-content risk detection.' },
  { id: 'technical-seo', name: 'TechnicalSEOSkill', desc: 'Indexability validation, metadata validation, schema validation, Core Web Vitals review.' },
  { id: 'revenue-analysis', name: 'RevenueAnalysisSkill', desc: 'Adsense potential, RPM estimation, commercial opportunity score, monetization priority.' },
  { id: 'deployment', name: 'DeploymentSkill', desc: 'Build verification, Cloudflare deployment readiness, rollback validation, production checklist.' },
  { id: 'google-update', name: 'GoogleUpdateSkill', desc: 'Google update monitoring, impact estimation, recovery recommendations, weekly adaptation plan.' },
  { id: 'recovery', name: 'RecoverySkill', desc: 'Ranking loss diagnosis, rollback planning, recovery workflow generation.' }
];

const baseDir = '/root/.gemini/skills';

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

skills.forEach(s => {
  const dir = path.join(baseDir, s.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${s.name}\n\n${s.desc}\n`);
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
    name: s.name,
    id: s.id,
    description: s.desc,
    version: "1.0.0",
    registered: true
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'examples.md'), `# ${s.name} Examples\n\n- Example 1\n- Example 2\n`);
});

console.log('Skills created successfully.');
