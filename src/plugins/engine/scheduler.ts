import type { CheckContext, PluginExecutionResult } from './types.js';
import { pluginExecutor } from './executor.js';
import { systemReporter } from './reporter.js';

/**
 * Executes plugin workflows segmented by cron-like scheduling rules.
 */
export class GovernorScheduler {
  
  /**
   * Run the Nightly System Audit
   * Expected execution: 0 2 * * *
   */
  async runNightlyAudit(context: CheckContext): Promise<Map<string, PluginExecutionResult>> {
    console.info('[GovernorScheduler] Initiating Nightly System Audit...');
    await systemReporter.initialize();

    // Nightly focuses on core health, SEO samples, and google updates.
    // In a real environment, we would filter instances by metadata. 
    // Here we run the on-schedule plugins.
    const results = await pluginExecutor.executeAll(context);
    
    // Generate Reports
    await systemReporter.generateDailySystemReport();
    await systemReporter.generateSeoAudit(Array.from(results.values()));
    
    return results;
  }

  /**
   * Run the Weekly Comprehensive Audit
   * Expected execution: 0 3 * * 0
   */
  async runWeeklyAudit(context: CheckContext): Promise<Map<string, PluginExecutionResult>> {
    console.info('[GovernorScheduler] Initiating Weekly Comprehensive Audit...');
    await systemReporter.initialize();

    const results = await pluginExecutor.executeAll(context);
    
    // Generate all deep reports
    await systemReporter.generatePluginAudit(Array.from(results.values()));
    await systemReporter.generateSkillAudit();
    await systemReporter.generateAgentAudit();
    await systemReporter.generateDeploymentAudit(Array.from(results.values()));
    
    return results;
  }
}

export const governorScheduler = new GovernorScheduler();
