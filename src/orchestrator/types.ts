/**
 * @fileoverview Type definitions for the Factory Orchestrator.
 * @module orchestrator/types
 */

export type OrchestratorState =
  | 'IDLE'
  | 'APPROVING'
  | 'BOOTSTRAPPING'
  | 'RESEARCHING'
  | 'ANALYZING'
  | 'SELECTING'
  | 'SPECIFYING'
  | 'CREATING'
  | 'PAGE_GENERATING'
  | 'SEO_VALIDATING'
  | 'GATING'
  | 'REWRITING'
  | 'COMMITTING'
  | 'DEPLOYING'
  | 'ANALYTICS_QUEUE'
  | 'GSC_QUEUE'
  | 'ADSENSE_QUEUE'
  | 'MONITORING'
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
  toolQuantity?: number;
  credentialsProvided?: boolean;
  state: OrchestratorState;
  keywords: KeywordOpportunity[];
  specifications: ToolSpecification[];
  files: GeneratedFile[];
  scorecard?: ValidationScorecard;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}
