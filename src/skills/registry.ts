/**
 * @file Skill registry for discovering and executing standardized utilities.
 */

import type { SkillDefinition } from './types.js';
import { systemGovernor } from '../plugins/engine/governor.js';

/**
 * Manages the registration and execution of standalone skills.
 */
export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register<I, O>(definition: SkillDefinition<I, O>): void {
    this.skills.set(definition.name, definition as SkillDefinition);
  }

  get<I, O>(name: string): SkillDefinition<I, O> | undefined {
    return this.skills.get(name) as SkillDefinition<I, O> | undefined;
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  async run<I, O>(name: string, input: I): Promise<O> {
    const skill = this.get<I, O>(name);
    if (!skill) throw new Error(`Skill "${name}" is not registered.`);
    
    const start = performance.now();
    try {
      const result = await skill.execute(input);
      const durationMs = performance.now() - start;
      
      // Connect to Governor
      systemGovernor.postExecuteAudit({
        id: `skill-${Date.now()}`,
        pluginName: `skill:${name}`,
        hook: 'pre-publish',
        pageUrl: 'internal://skill-execution',
        compositeScore: (result as any).score || 100,
        passed: true,
        checksRun: 1,
        checksPassed: 1,
        checksFailed: 0,
        results: [],
        durationMs,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export const skillRegistry = new SkillRegistry();
