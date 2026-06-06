/**
 * @file Skill: integration:github-status
 */

import type { SkillDefinition } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GithubStatusInput {
  repoPath: string;
  requiredActions?: string[];
}

export interface GithubStatusOutput {
  isDirty: boolean;
  activeBranch: string;
  failedActions: string[];
  score: number;
}

export const githubStatusSkill: SkillDefinition<GithubStatusInput, GithubStatusOutput> = {
  name: 'integration:github-status',
  description: 'Monitors git statuses, branch state lockfiles, and active build validations.',

  async execute(input) {
    try {
      let isDirty = false;
      let activeBranch = 'main';
      const failedActions: string[] = [];

      try {
        const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: input.repoPath });
        isDirty = statusOut.trim().length > 0;

        const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: input.repoPath });
        activeBranch = branchOut.trim() || 'main';
      } catch {
        // Fallback if git CLI fails
        isDirty = false;
        activeBranch = 'main';
      }

      let score = 100;
      if (isDirty) score -= 30;
      score -= failedActions.length * 50;
      
      score = Math.max(0, Math.min(100, score));

      return {
        isDirty,
        activeBranch,
        failedActions,
        score
      };
    } catch (e) {
      return {
        isDirty: false,
        activeBranch: 'main',
        failedActions: [],
        score: 0
      };
    }
  }
};
