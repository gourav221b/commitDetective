import type { AnalyzeCommitLineageOutput } from '@/ai/flows/analyze-commit-lineage';

export interface AnalysisResult {
  commitLineage: AnalyzeCommitLineageOutput;
}

export interface AnalysisState {
  result?: AnalysisResult;
  error?: string;
  loading: boolean;
}
