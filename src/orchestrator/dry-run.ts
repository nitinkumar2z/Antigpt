/**
 * @fileoverview Dry-run executor for the Factory Orchestrator v1.
 * @module orchestrator/dry-run
 */

import { OrchestratorEngine } from './engine.js';
import '../skills/index.js'; // Bootstrap skills registry

async function main() {
  const args = process.argv.slice(2);
  const niche = args[0] || 'PDF to Markdown Converter';
  const quantity = parseInt(args[1], 10) || 2;

  const engine = new OrchestratorEngine();

  console.log('=== FACTORY ORCHESTRATOR DRY-RUN INITIATED ===');
  console.log(`Target Niche: "${niche}"`);
  console.log(`Target Quantity: ${quantity}`);
  try {
    const job = await engine.executeJob(niche, quantity);
    console.log('=== DRY-RUN COMPLETED SUCCESSFULLY ===');
    console.log(JSON.stringify(job, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('=== DRY-RUN FAILED ===', err);
    process.exit(1);
  }
}

main();
