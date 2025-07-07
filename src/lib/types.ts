
export interface CommitNode {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branch?: string;
  type?: string;
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
