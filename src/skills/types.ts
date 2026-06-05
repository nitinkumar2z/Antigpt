/**
 * @file Core type definitions for the Skills Layer.
 */

/**
 * Standard interface for all skills.
 */
export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique name identifying the skill (e.g. "text:flesch-readability"). */
  name: string;
  
  /** Short description of utility. */
  description: string;
  
  /** Core execution logic. */
  execute: (input: TInput) => Promise<TOutput>;
}
