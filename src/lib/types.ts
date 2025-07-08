
export interface CommitNode {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branch?: string;
  type?: string;
  metadata?: {
    originalCommitCount?: number;
    originalCommits?: string[];
    squashedFrom?: string;
    modifiedHistory?: boolean;
    linearHistory?: boolean;
    baseChanged?: boolean;
    confidence?: number;
    [key: string]: any;
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
