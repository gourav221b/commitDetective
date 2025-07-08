
export interface CommitNode {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branch?: string;
  type?: string;
  children?: CommitNode[];
  metadata?: {
    originalCommitCount?: number;
    originalCommits?: string[];
    squashedFrom?: string;
    modifiedHistory?: boolean;
    linearHistory?: boolean;
    baseChanged?: boolean;
    confidence?: number;
    detectionMethods?: SquashDetectionResult[];
    analysisDepth?: string;
    [key: string]: any;
  };
}

export interface SquashDetectionResult {
  method: string;
  confidence: number;
  isSquash: boolean;
  reasoning: string;
  evidence: Record<string, any>;
  weight: number;
}

export interface SquashAnalysisConfig {
  analysisDepth: string;
  enabledMethods: string[];
  confidenceThreshold: number;
  crossValidationRequired: boolean;
}

export interface GitHubMergeEvent {
  event: string;
  merge_strategy?: 'merge' | 'squash' | 'rebase';
  created_at: string;
  actor?: {
    login: string;
  };
}

export interface AnalyzeCommitLineageOutput {
  summary: string;
  nodes: CommitNode[];
}

export interface AnalysisResult {
  commitLineage: AnalyzeCommitLineageOutput;
}

export interface AnalysisState {
  result?: AnalysisResult;
  error?: string;
  loading: boolean;
}
