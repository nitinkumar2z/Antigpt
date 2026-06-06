/**
 * @fileoverview Dry-run executor for the Factory Orchestrator v1.
 * @module orchestrator/dry-run
 */

import { OrchestratorEngine } from './engine.js';
import '../skills/index.js'; // Bootstrap skills registry

async function main() {
  const engine = new OrchestratorEngine();
  const niche = 'PDF to Markdown Converter';

  console.log('=== FACTORY ORCHESTRATOR DRY-RUN INITIATED ===');
  try {
    const job = await engine.executeJob(niche);
    console.log('=== DRY-RUN COMPLETED SUCCESSFULLY ===');
    console.log(JSON.stringify(job, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('=== DRY-RUN FAILED ===', err);
    process.exit(1);
  }
}

main();
