/**
 * @fileoverview Type definitions for the Factory Orchestrator.
 * @module orchestrator/types
 */

export type OrchestratorState =
  | 'IDLE'
  | 'RESEARCHING'
  | 'SPECIFYING'
  | 'GENERATING'
  | 'VALIDATING'
  | 'GATING'
  | 'DEPLOYING'
  | 'MONITORING'
  | 'REWRITING'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED';

export interface KeywordOpportunity {
  keyword: string;
  volume: number;
  intent: string;
  priorityScore: number;
}

export interface ToolSpecification {
  name: string;
  description: string;
  schemaSql?: string;
  routes: string[];
  dependencies: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ValidationScorecard {
  compositeScore: number;
  passed: boolean;
  details: Record<string, any>;
}

export interface OrchestratorJob {
  jobId: string;
  niche: string;
  state: OrchestratorState;
  keywords: KeywordOpportunity[];
  specifications: ToolSpecification[];
  files: GeneratedFile[];
  scorecard?: ValidationScorecard;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}
