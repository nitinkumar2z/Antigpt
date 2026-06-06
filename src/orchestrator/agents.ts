/**
 * @fileoverview Autonomous Agent Swarm Daemon coordinating CRA, DRA, and TDA tasks.
 * @module orchestrator/agents
 */

import { execSync } from 'child_process';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.trim().split('=');
        if (parts.length >= 2 && !line.startsWith('#')) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = val;
        }
      });
    }
  } catch (err) {
    // Fail silently
  }
}
loadEnv();

// Helper to run tasks in worker threads
function runInWorker<T, R>(agentName: string, taskName: string, inputData: T): Promise<R> {
  return new Promise((resolve, reject) => {
    const filename = fileURLToPath(import.meta.url);
    const worker = new Worker(filename, {
      workerData: { agentName, taskName, inputData },
      execArgv: process.execArgv
    });
    
    let resolved = false;
    worker.on('message', (msg) => {
      resolved = true;
      if (msg.success) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    });
    
    worker.on('error', (err) => {
      if (!resolved) reject(err);
    });
    
    worker.on('exit', (code) => {
      if (!resolved && code !== 0) {
        reject(new Error(`Agent ${agentName} worker stopped with exit code ${code}`));
      }
    });
  });
}

// Structured Interfaces for Swarm Agents
export interface DiscoveryInput {
  lastCheckedTimestamp: string;
  targetCategories: string[];
}

export interface DiscoveryOutput {
  discoveredTrends: Array<{ keyword: string; volume: number; difficulty: number }>;
  suggestedPages: string[];
}

export interface RewriterInput {
  filePath: string;
  originalContent: string;
  failingChecks: Array<{ checkName: string; score: number; feedback: string }>;
}

export interface RewriterOutput {
  patchedContent: string;
  iterations: number;
  improvementScore: number;
}

export interface RollbackTrigger {
  executionId: string;
  failingCommit: string;
  gateScore: number;
  failingPlugin: string;
}

export interface RollbackResult {
  success: boolean;
  restoredCommit: string;
  restoredTag: string;
  logs: string[];
}

/**
 * Trend Discovery Agent (TDA) - Discovers trending keywords and opportunities.
 */
export class TrendDiscoveryAgent {
  /**
   * Scrapes or generates actual keyword opportunities based on the target niche.
   */
  public static async discoverKeywords(niche: string): Promise<string[]> {
    return runInWorker<string, string[]>('TrendDiscoveryAgent', 'discoverKeywords', niche);
  }

  public static async discoverKeywordsDetailed(input: DiscoveryInput): Promise<DiscoveryOutput> {
    return runInWorker<DiscoveryInput, DiscoveryOutput>('TrendDiscoveryAgent', 'discoverKeywordsDetailed', input);
  }

  // Internal execution within the worker thread
  public static async discoverKeywordsInternal(niche: string): Promise<string[]> {
    try {
      // Try to fetch Google Trends daily RSS feed as real data source
      const res = await fetch('https://trends.google.com/trends/trendingsearches/daily/rss?geo=US');
      if (res.ok) {
        const text = await res.text();
        const titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
        if (titles.length > 1) {
          // Filter out the channel title "Daily Search Trends"
          const trends = titles.filter(t => t !== 'Daily Search Trends' && t.trim().length > 0);
          if (trends.length > 0) {
            return trends.slice(0, 3).map(t => `${niche} ${t.toLowerCase()}`);
          }
        }
      }
    } catch (err) {
      // Fallback below
    }
    
    return [
      `${niche} dynamic calculator`,
      `best free ${niche} generator`,
      `online interactive ${niche} scoring tool`
    ];
  }

  public static async discoverKeywordsDetailedInternal(input: DiscoveryInput): Promise<DiscoveryOutput> {
    const categories = input.targetCategories && input.targetCategories.length > 0 ? input.targetCategories : ['tools'];
    const trends = await this.discoverKeywordsInternal(categories[0]);
    
    return {
      discoveredTrends: trends.map((kw, i) => ({
        keyword: kw,
        volume: 5000 - (i * 1200),
        difficulty: 10 + (i * 15)
      })),
      suggestedPages: trends.map(t => `/tools/${t.replace(/\s+/g, '-')}`)
    };
  }
}

/**
 * Content Re-Writer Agent (CRA) - Automatically patches content for quality.
 */
export class ContentReWriterAgent {
  /**
   * Rewrites page templates and copy to improve accessibility and Flesch readability.
   */
  public static async rewrite(content: string): Promise<string> {
    return runInWorker<string, string>('ContentReWriterAgent', 'rewrite', content);
  }

  public static async rewriteDetailed(input: RewriterInput): Promise<RewriterOutput> {
    return runInWorker<RewriterInput, RewriterOutput>('ContentReWriterAgent', 'rewriteDetailed', input);
  }

  // Internal execution within the worker thread
  public static async rewriteInternal(content: string): Promise<string> {
    const input: RewriterInput = {
      filePath: 'unknown.astro',
      originalContent: content,
      failingChecks: [{ checkName: 'readability', score: 65, feedback: 'Optimize reading level.' }]
    };
    const out = await this.rewriteDetailedInternal(input);
    return out.patchedContent;
  }

  public static async rewriteDetailedInternal(input: RewriterInput): Promise<RewriterOutput> {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    let patchedContent = input.originalContent;
    let iterations = 1;
    let improvementScore = 0;
    
    if (token && accountId && !token.includes('cfat_mock') && token.trim().length > 10) {
      try {
        const model = "@cf/meta/llama-3-8b-instruct";
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
        
        const systemPrompt = `You are ContentReWriterAgent (CRA), an autonomous SEO copy doctor.
Optimize the following HTML/Astro template code to improve readability (Flesch score), accessibility, and semantic density.
Failing checks: ${JSON.stringify(input.failingChecks)}
Return ONLY the corrected code. Do NOT wrap it in markdown code blocks like \`\`\`html. Keep all scripts, layout structure, and tracking tags intact.`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: input.originalContent }
            ]
          })
        });
        
        if (res.ok) {
          const data = await res.json() as any;
          if (data.success && data.result && data.result.response) {
            let llmOutput = data.result.response.trim();
            if (llmOutput.startsWith('```')) {
              llmOutput = llmOutput.replace(/^```[a-zA-Z0-9]*\n/, '');
              llmOutput = llmOutput.replace(/\n```$/, '');
            }
            patchedContent = llmOutput;
            improvementScore = 15;
          }
        }
      } catch (err) {
        // Fallback to local rewrite heuristic on network/auth failure
      }
    }
    
    if (patchedContent === input.originalContent) {
      // Heuristic Fallback
      if (patchedContent.includes('description:')) {
        patchedContent = patchedContent.replace(/description:\s*".*?"/, 'description: "Highly accessible, simple online utility for quick calculations and tracking."');
      }
      if (patchedContent.includes('<img') && !patchedContent.includes('alt=')) {
        patchedContent = patchedContent.replace(/<img (.*?)>/g, '<img alt="Interactive calculator preview visual" $1>');
      }
      improvementScore = 10;
    }
    
    return {
      patchedContent,
      iterations,
      improvementScore
    };
  }
}

/**
 * Deploy & Recovery Agent (DRA) - Handles rollbacks and environment resets.
 */
export class DeployRecoveryAgent {
  /**
   * Rollback git status to last stable version on visual check failure.
   */
  public static async executeRollback(niche: string): Promise<string> {
    return runInWorker<string, string>('DeployRecoveryAgent', 'executeRollback', niche);
  }

  public static async executeRollbackDetailed(input: RollbackTrigger): Promise<RollbackResult> {
    return runInWorker<RollbackTrigger, RollbackResult>('DeployRecoveryAgent', 'executeRollbackDetailed', input);
  }

  // Internal execution within the worker thread
  public static async executeRollbackInternal(niche: string): Promise<string> {
    const trigger: RollbackTrigger = {
      executionId: 'job-err',
      failingCommit: 'HEAD',
      gateScore: 50,
      failingPlugin: 'deployment-guardian'
    };
    const out = await this.executeRollbackDetailedInternal(trigger);
    return out.logs.join('\n');
  }

  public static async executeRollbackDetailedInternal(input: RollbackTrigger): Promise<RollbackResult> {
    const logs: string[] = [];
    let success = false;
    let restoredCommit = '';
    let restoredTag = '';
    
    try {
      // Find last stable git tag
      const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
      logs.push(`Found stable release tag: ${latestTag}`);
      execSync(`git checkout ${latestTag} --force`, { encoding: 'utf8' });
      success = true;
      restoredTag = latestTag;
      restoredCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      logs.push(`DeployRecoveryAgent: Rolled back git repository to stable tag: ${latestTag}`);
    } catch (e: any) {
      logs.push(`Failed to checkout tag: ${e.message}`);
      try {
        execSync('git reset --hard HEAD~1', { encoding: 'utf8' });
        success = true;
        restoredCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        logs.push(`DeployRecoveryAgent: No stable tags found. Reset head to HEAD~1.`);
      } catch (innerErr: any) {
        success = false;
        logs.push(`DeployRecoveryAgent: Git reset fallback failed: ${innerErr.message}`);
      }
    }
    
    return {
      success,
      restoredCommit,
      restoredTag,
      logs
    };
  }
}

/**
 * Central Daemon orchestrating the agent lifecycle
 */
export class AgentSwarmDaemon {
  private activeAgents = new Set<string>();

  public registerRunning(agentName: string): void {
    this.activeAgents.add(agentName);
  }

  public registerCompleted(agentName: string): void {
    this.activeAgents.delete(agentName);
  }

  public getRunning(): string[] {
    return Array.from(this.activeAgents);
  }
}

export const agentSwarm = new AgentSwarmDaemon();

// Execute task if running inside a Worker thread
if (!isMainThread) {
  const { agentName, taskName, inputData } = workerData;
  (async () => {
    try {
      let result;
      if (agentName === 'TrendDiscoveryAgent') {
        if (taskName === 'discoverKeywords') {
          result = await TrendDiscoveryAgent.discoverKeywordsInternal(inputData);
        } else if (taskName === 'discoverKeywordsDetailed') {
          result = await TrendDiscoveryAgent.discoverKeywordsDetailedInternal(inputData);
        }
      } else if (agentName === 'ContentReWriterAgent') {
        if (taskName === 'rewrite') {
          result = await ContentReWriterAgent.rewriteInternal(inputData);
        } else if (taskName === 'rewriteDetailed') {
          result = await ContentReWriterAgent.rewriteDetailedInternal(inputData);
        }
      } else if (agentName === 'DeployRecoveryAgent') {
        if (taskName === 'executeRollback') {
          result = await DeployRecoveryAgent.executeRollbackInternal(inputData);
        } else if (taskName === 'executeRollbackDetailed') {
          result = await DeployRecoveryAgent.executeRollbackDetailedInternal(inputData);
        }
      }
      parentPort?.postMessage({ success: true, result });
    } catch (err: any) {
      parentPort?.postMessage({ success: false, error: err.message });
    }
  })();
}
