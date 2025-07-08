import type { SquashAnalysisConfig, CommitNode } from '@/lib/types';
import type { GitHubCommit, PullRequestData } from '@/ai/tools/github-tools';
import { AdvancedSquashDetector } from './advanced-squash-detector';
import { Octokit } from '@octokit/rest';

/**
 * Analysis Depth Manager
 * 
 * Manages the configurable depth of squash analysis:
 * - Deep Analysis: Recursively expands ALL nested/squashed PRs
 * - Shallow Analysis: Only expands the first level of squash commits
 */
export class AnalysisDepthManager {
  private detector: AdvancedSquashDetector;
  private config: SquashAnalysisConfig;
  private octokit: Octokit;

  constructor(octokit: Octokit, config: SquashAnalysisConfig) {
    this.octokit = octokit;
    this.config = config;
    this.detector = new AdvancedSquashDetector(octokit, config);
  }

  /**
   * Main analysis method that respects the configured analysis depth
   */
  async analyzeWithDepth(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    prData: PullRequestData,
    repoOwner: string,
    repoName: string,
    processedPRs: Set<number> = new Set(),
    currentDepth: number = 0
  ): Promise<{
    isSquash: boolean;
    confidence: number;
    expandedCommits: CommitNode[];
    analysisMetadata: any;
  }> {
    // Detect if this is a squash commit using advanced detection
    const squashResult = await this.detector.detectSquash(
      mergeCommit,
      prCommits,
      prData,
      repoOwner,
      repoName
    );

    const analysisMetadata = {
      detectionMethods: squashResult.methods,
      analysisDepth: this.config.analysisDepth,
      currentDepth,
      reasoning: squashResult.reasoning
    };

    // If not a squash, return basic result
    if (!squashResult.isSquash) {
      return {
        isSquash: false,
        confidence: squashResult.confidence,
        expandedCommits: [],
        analysisMetadata
      };
    }

    // Handle squash commit based on analysis depth configuration
    if (this.config.analysisDepth === 'shallow') {
      return this.performShallowAnalysis(
        mergeCommit,
        prCommits,
        prData,
        squashResult,
        analysisMetadata
      );
    } else {
      return this.performDeepAnalysis(
        mergeCommit,
        prCommits,
        prData,
        repoOwner,
        repoName,
        squashResult,
        processedPRs,
        currentDepth,
        analysisMetadata
      );
    }
  }

  /**
   * Shallow Analysis: Only expand the immediate squash commit
   * 
   * When a squash commit is detected, show the original commits that were squashed
   * but don't recursively expand any nested squashes within those commits.
   */
  private async performShallowAnalysis(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    prData: PullRequestData,
    squashResult: any,
    analysisMetadata: any
  ): Promise<{
    isSquash: boolean;
    confidence: number;
    expandedCommits: CommitNode[];
    analysisMetadata: any;
  }> {
    const expandedCommits: CommitNode[] = [];

    // Add the original PR commits that were squashed
    for (const commit of prCommits) {
      expandedCommits.push({
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name || 'N/A',
        date: commit.commit.author?.date || new Date().toISOString(),
        parents: commit.parents.map(p => p.sha),
        branch: prData.prDetails.head.ref,
        type: 'Squashed Commit',
        metadata: {
          originallySquashed: true,
          squashParent: mergeCommit.sha,
          analysisDepth: 'shallow',
          detectionMethods: squashResult.methods,
          confidence: squashResult.confidence
        }
      });
    }

    analysisMetadata.expandedCommitsCount = expandedCommits.length;
    analysisMetadata.shallowAnalysisComplete = true;

    return {
      isSquash: true,
      confidence: squashResult.confidence,
      expandedCommits,
      analysisMetadata
    };
  }

  /**
   * Deep Analysis: Recursively expand ALL nested squashes
   * 
   * When a squash commit is detected, recursively analyze any nested PRs
   * and expand their squash commits as well, creating a complete commit history.
   */
  private async performDeepAnalysis(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    prData: PullRequestData,
    repoOwner: string,
    repoName: string,
    squashResult: any,
    processedPRs: Set<number>,
    currentDepth: number,
    analysisMetadata: any
  ): Promise<{
    isSquash: boolean;
    confidence: number;
    expandedCommits: CommitNode[];
    analysisMetadata: any;
  }> {
    const expandedCommits: CommitNode[] = [];
    const maxDepth = 5; // Prevent infinite recursion

    if (currentDepth >= maxDepth) {
      analysisMetadata.maxDepthReached = true;
      return this.performShallowAnalysis(mergeCommit, prCommits, prData, squashResult, analysisMetadata);
    }

    // Process each commit in the PR
    for (const commit of prCommits) {
      // Check if this commit references a nested PR
      const nestedPrNumber = this.extractPrNumberFromMessage(commit.commit.message);

      if (nestedPrNumber && !processedPRs.has(nestedPrNumber)) {
        processedPRs.add(nestedPrNumber);

        try {
          // Fetch the nested PR data
          const nestedPrData = await this.fetchPullRequestData(repoOwner, repoName, nestedPrNumber);

          if (nestedPrData && nestedPrData.mergeCommit) {
            // Recursively analyze the nested PR
            const nestedAnalysis = await this.analyzeWithDepth(
              nestedPrData.mergeCommit,
              nestedPrData.prCommits,
              nestedPrData,
              repoOwner,
              repoName,
              processedPRs,
              currentDepth + 1
            );

            // Add the nested analysis results
            if (nestedAnalysis.isSquash && nestedAnalysis.expandedCommits.length > 0) {
              // Add expanded commits from nested squash
              expandedCommits.push(...nestedAnalysis.expandedCommits);

              // Add metadata about the nested analysis
              analysisMetadata.nestedAnalyses = analysisMetadata.nestedAnalyses || [];
              analysisMetadata.nestedAnalyses.push({
                prNumber: nestedPrNumber,
                depth: currentDepth + 1,
                ...nestedAnalysis.analysisMetadata
              });
            } else {
              // Add the commit as-is if not a squash
              expandedCommits.push(this.createCommitNode(commit, prData, {
                nestedPrNumber,
                analysisDepth: 'deep',
                currentDepth: currentDepth + 1
              }));
            }
          } else {
            // Add the commit as-is if we can't fetch nested PR data
            expandedCommits.push(this.createCommitNode(commit, prData, {
              nestedPrNumber,
              analysisDepth: 'deep',
              fetchFailed: true
            }));
          }
        } catch (error: any) {
          // Add the commit as-is if nested analysis fails
          expandedCommits.push(this.createCommitNode(commit, prData, {
            nestedPrNumber,
            analysisDepth: 'deep',
            error: error.message
          }));
        }
      } else {
        // Add regular commit
        expandedCommits.push(this.createCommitNode(commit, prData, {
          analysisDepth: 'deep',
          currentDepth
        }));
      }
    }

    analysisMetadata.expandedCommitsCount = expandedCommits.length;
    analysisMetadata.deepAnalysisComplete = true;
    analysisMetadata.finalDepth = currentDepth;

    return {
      isSquash: true,
      confidence: squashResult.confidence,
      expandedCommits,
      analysisMetadata
    };
  }

  /**
   * Helper method to create a CommitNode from a GitHubCommit
   */
  private createCommitNode(
    commit: GitHubCommit,
    prData: PullRequestData,
    additionalMetadata: any = {}
  ): CommitNode {
    return {
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      author: commit.commit.author?.name || 'N/A',
      date: commit.commit.author?.date || new Date().toISOString(),
      parents: commit.parents.map(p => p.sha),
      branch: prData.prDetails.head.ref,
      type: 'Expanded Commit',
      metadata: {
        originallySquashed: true,
        ...additionalMetadata
      }
    };
  }

  /**
   * Helper method to extract PR number from commit message
   */
  private extractPrNumberFromMessage(message: string): number | null {
    const match = message.match(/\(#(\d+)\)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Helper method to fetch pull request data
   */
  private async fetchPullRequestData(
    repoOwner: string,
    repoName: string,
    pullRequestNumber: number
  ): Promise<PullRequestData | null> {
    try {
      // Import the getPullRequestData function
      const { getPullRequestData } = await import('@/ai/tools/github-tools');
      return await getPullRequestData(this.octokit, repoOwner, repoName, pullRequestNumber);
    } catch (error) {
      console.warn(`Failed to fetch PR #${pullRequestNumber}:`, error);
      return null;
    }
  }

  /**
   * Get default configuration for analysis depth
   */
  static getDefaultConfig(analysisDepth: 'shallow' | 'deep' = 'shallow'): SquashAnalysisConfig {
    return {
      analysisDepth,
      enabledMethods: [
        'github-api-strategy',
        'timestamp-pattern',
        'author-committer-discrepancy',
        'github-events-api',
        'legacy-heuristics'
      ],
      confidenceThreshold: 0.6,
      crossValidationRequired: true
    };
  }

  /**
   * Get performance-optimized configuration (fewer methods for faster analysis)
   */
  static getPerformanceConfig(analysisDepth: 'shallow' | 'deep' = 'shallow'): SquashAnalysisConfig {
    return {
      analysisDepth,
      enabledMethods: [
        'github-api-strategy',
        'timestamp-pattern',
        'legacy-heuristics'
      ],
      confidenceThreshold: 0.5,
      crossValidationRequired: false
    };
  }

  /**
   * Get comprehensive configuration (all methods for maximum accuracy)
   */
  static getComprehensiveConfig(analysisDepth: 'shallow' | 'deep' = 'deep'): SquashAnalysisConfig {
    return {
      analysisDepth,
      enabledMethods: [
        'github-api-strategy',
        'timestamp-pattern',
        'author-committer-discrepancy',
        'commit-tree-structure',
        'github-events-api',
        'diff-analysis',
        'legacy-heuristics'
      ],
      confidenceThreshold: 0.7,
      crossValidationRequired: true
    };
  }
}
