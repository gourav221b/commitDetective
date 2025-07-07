import type { GitHubCommit, ExtractGitHubDataOutput } from '@/ai/flows/extract-github-data';
import type { AnalyzeCommitLineageOutput } from '@/ai/flows/analyze-commit-lineage';
import type { CalculateLTCOutput } from '@/ai/flows/calculate-ltc';

export interface AnalysisResult {
  githubData: ExtractGitHubDataOutput;
  ltc: CalculateLTCOutput;
  commitLineage: AnalyzeCommitLineageOutput;
}

export interface AnalysisState {
  result?: AnalysisResult;
  error?: string;
  loading: boolean;
}
