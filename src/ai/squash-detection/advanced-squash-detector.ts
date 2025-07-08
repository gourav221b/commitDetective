import type { GitHubCommit, TimelineEvent, PullRequestData } from '@/ai/tools/github-tools';
import type { SquashDetectionResult, SquashAnalysisConfig, GitHubMergeEvent } from '@/lib/types';
import { Octokit } from '@octokit/rest';

/**
 * Advanced Squash Detection System
 * 
 * This system implements multiple sophisticated detection methods to accurately
 * identify squash commits with high confidence and detailed reasoning.
 */
export class AdvancedSquashDetector {
  private config: SquashAnalysisConfig;
  private octokit: Octokit;

  constructor(octokit: Octokit, config: SquashAnalysisConfig) {
    this.octokit = octokit;
    this.config = config;
  }

  /**
   * Main detection method that runs all enabled algorithms and cross-validates results
   */
  async detectSquash(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    prData: PullRequestData,
    repoOwner: string,
    repoName: string
  ): Promise<{
    isSquash: boolean;
    confidence: number;
    methods: SquashDetectionResult[];
    reasoning: string;
  }> {
    const detectionResults: SquashDetectionResult[] = [];

    // Run all enabled detection methods
    if (this.config.enabledMethods.includes('github-api-strategy')) {
      detectionResults.push(await this.detectViaGitHubAPIStrategy(prData, repoOwner, repoName));
    }

    if (this.config.enabledMethods.includes('timestamp-pattern')) {
      detectionResults.push(this.detectViaTimestampPattern(mergeCommit, prCommits));
    }

    if (this.config.enabledMethods.includes('author-committer-discrepancy')) {
      detectionResults.push(this.detectViaAuthorCommitterDiscrepancy(mergeCommit, prCommits));
    }

    if (this.config.enabledMethods.includes('commit-tree-structure')) {
      detectionResults.push(await this.detectViaCommitTreeStructure(mergeCommit, prCommits, repoOwner, repoName));
    }

    if (this.config.enabledMethods.includes('github-events-api')) {
      detectionResults.push(await this.detectViaGitHubEventsAPI(prData, repoOwner, repoName));
    }

    if (this.config.enabledMethods.includes('diff-analysis')) {
      detectionResults.push(await this.detectViaDiffAnalysis(mergeCommit, prCommits, repoOwner, repoName));
    }

    // Legacy method for backward compatibility
    if (this.config.enabledMethods.includes('legacy-heuristics')) {
      detectionResults.push(this.detectViaLegacyHeuristics(mergeCommit, prCommits));
    }

    // Cross-validate results
    return this.crossValidateResults(detectionResults);
  }

  /**
   * Method 1: GitHub API Merge Strategy Analysis
   * 
   * Uses GitHub's PR merge information to detect squash strategy.
   * This is the most reliable method when available.
   */
  private async detectViaGitHubAPIStrategy(
    prData: PullRequestData,
    repoOwner: string,
    repoName: string
  ): Promise<SquashDetectionResult> {
    try {
      // Check if PR details contain merge strategy information
      const prDetails = prData.prDetails as any;

      // GitHub sometimes includes merge strategy in PR details
      if (prDetails.merged_by && prDetails.merge_commit_sha) {
        // Check if the merge commit message indicates squash
        const mergeMessage = prData.mergeCommit?.commit.message || '';
        const hasSquashIndicators = this.analyzeSquashIndicatorsInMessage(mergeMessage);

        // Check if all PR commits are missing from the main branch
        // (indicating they were squashed into the merge commit)
        const commitsInMainBranch = await this.checkCommitsInMainBranch(
          prData.prCommits,
          repoOwner,
          repoName,
          prDetails.base.ref
        );

        const evidence = {
          mergeCommitSha: prDetails.merge_commit_sha,
          mergedBy: prDetails.merged_by?.login,
          hasSquashIndicators,
          commitsInMainBranch: commitsInMainBranch.length,
          totalPrCommits: prData.prCommits.length
        };

        const isSquash = hasSquashIndicators && commitsInMainBranch.length === 0 && prData.prCommits.length > 1;

        return {
          method: 'github-api-strategy',
          confidence: isSquash ? 0.95 : 0.3,
          isSquash,
          reasoning: isSquash
            ? 'GitHub API indicates squash merge: merge commit exists, PR commits not in main branch, squash indicators in message'
            : 'GitHub API does not indicate squash merge',
          evidence,
          weight: 0.4 // High weight for this reliable method
        };
      }

      return {
        method: 'github-api-strategy',
        confidence: 0.1,
        isSquash: false,
        reasoning: 'Insufficient GitHub API data to determine merge strategy',
        evidence: { available: false },
        weight: 0.4
      };

    } catch (error: any) {
      return {
        method: 'github-api-strategy',
        confidence: 0.0,
        isSquash: false,
        reasoning: `GitHub API strategy detection failed: ${error.message}`,
        evidence: { error: error.message },
        weight: 0.4
      };
    }
  }

  /**
   * Method 2: Commit Timestamp Pattern Analysis
   * 
   * Analyzes timestamp patterns that indicate squashing.
   * Squashed commits often have identical or very close timestamps.
   */
  private detectViaTimestampPattern(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[]
  ): SquashDetectionResult {
    if (prCommits.length <= 1) {
      return {
        method: 'timestamp-pattern',
        confidence: 0.1,
        isSquash: false,
        reasoning: 'Insufficient commits for timestamp analysis',
        evidence: { commitCount: prCommits.length },
        weight: 0.2
      };
    }

    const mergeTimestamp = new Date(mergeCommit.commit.author?.date || 0).getTime();
    const commitTimestamps = prCommits.map(c => new Date(c.commit.author?.date || 0).getTime());

    // Check if all commits have very similar timestamps (within 1 minute)
    const timestampVariance = Math.max(...commitTimestamps) - Math.min(...commitTimestamps);
    const hasClusteredTimestamps = timestampVariance < 60000; // 1 minute

    // Check if merge commit timestamp is close to PR commit timestamps
    const avgCommitTimestamp = commitTimestamps.reduce((a, b) => a + b, 0) / commitTimestamps.length;
    const mergeTimestampDiff = Math.abs(mergeTimestamp - avgCommitTimestamp);
    const mergeTimestampClose = mergeTimestampDiff < 300000; // 5 minutes

    // Check for rapid succession of commits (potential squash preparation)
    const rapidSuccession = commitTimestamps.every((ts, i) =>
      i === 0 || (ts - commitTimestamps[i - 1]) < 3600000 // 1 hour between commits
    );

    const evidence = {
      timestampVariance,
      hasClusteredTimestamps,
      mergeTimestampDiff,
      mergeTimestampClose,
      rapidSuccession,
      commitTimestamps,
      mergeTimestamp
    };

    // Squash indicators: clustered timestamps + merge timestamp close to commits
    const isSquash = hasClusteredTimestamps && mergeTimestampClose && prCommits.length > 1;
    const confidence = isSquash ? 0.7 : (hasClusteredTimestamps ? 0.4 : 0.2);

    return {
      method: 'timestamp-pattern',
      confidence,
      isSquash,
      reasoning: isSquash
        ? 'Timestamp pattern indicates squash: commits have clustered timestamps and merge commit timestamp is close'
        : 'Timestamp pattern does not indicate squash merge',
      evidence,
      weight: 0.2
    };
  }

  /**
   * Method 3: Author vs Committer Discrepancy Detection
   * 
   * Analyzes differences between commit author and committer information.
   * Squashed commits often show the merger as committer but original author preserved.
   */
  private detectViaAuthorCommitterDiscrepancy(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[]
  ): SquashDetectionResult {
    const mergeAuthor = mergeCommit.commit.author?.email;
    const mergeCommitter = mergeCommit.commit.committer?.email;

    // Check if merge commit has different author vs committer
    const hasAuthorCommitterDiff = mergeAuthor !== mergeCommitter;

    // Check if merge commit author matches any of the PR commit authors
    const prAuthors = prCommits.map(c => c.commit.author?.email).filter(Boolean);
    const mergeAuthorInPrAuthors = prAuthors.includes(mergeAuthor);

    // Check if all PR commits have same author as merge commit
    const allSameAuthor = prAuthors.every(author => author === mergeAuthor);

    // Check committer patterns in PR commits
    const prCommitters = prCommits.map(c => c.commit.committer?.email).filter(Boolean);
    const hasVariedCommitters = new Set(prCommitters).size > 1;

    const evidence = {
      mergeAuthor,
      mergeCommitter,
      hasAuthorCommitterDiff,
      mergeAuthorInPrAuthors,
      allSameAuthor,
      prAuthors: [...new Set(prAuthors)],
      prCommitters: [...new Set(prCommitters)],
      hasVariedCommitters
    };

    // Squash indicators: merge commit has different committer, but author matches PR authors
    const isSquash = hasAuthorCommitterDiff && mergeAuthorInPrAuthors && prCommits.length > 1;
    const confidence = isSquash ? 0.6 : 0.3;

    return {
      method: 'author-committer-discrepancy',
      confidence,
      isSquash,
      reasoning: isSquash
        ? 'Author/committer pattern indicates squash: merge commit has different committer but preserves original author'
        : 'Author/committer pattern does not clearly indicate squash',
      evidence,
      weight: 0.15
    };
  }

  /**
   * Helper method to analyze squash indicators in commit messages
   */
  private analyzeSquashIndicatorsInMessage(message: string): boolean {
    const squashPatterns = [
      /squash/i,
      /\(\#\d+\)/,  // PR number pattern
      /^[^:]+:\s*[^:]+$/,  // Conventional commit pattern
      /\* /m,  // Bullet points (common in squash messages)
      /co-authored-by:/i  // Co-authored pattern
    ];

    return squashPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Helper method to check which commits exist in the main branch
   */
  private async checkCommitsInMainBranch(
    commits: GitHubCommit[],
    repoOwner: string,
    repoName: string,
    baseBranch: string
  ): Promise<string[]> {
    const existingCommits: string[] = [];

    for (const commit of commits.slice(0, 5)) { // Limit to first 5 commits for performance
      try {
        await this.octokit.repos.getCommit({
          owner: repoOwner,
          repo: repoName,
          ref: commit.sha
        });
        existingCommits.push(commit.sha);
      } catch (error: any) {
        // Commit doesn't exist in main branch (likely squashed)
      }
    }

    return existingCommits;
  }

  /**
   * Method 4: Commit Tree Structure Analysis
   *
   * Analyzes the git tree structure to identify squash patterns.
   * Squashed commits often have different tree structures than their constituent commits.
   */
  private async detectViaCommitTreeStructure(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    repoOwner: string,
    repoName: string
  ): Promise<SquashDetectionResult> {
    try {
      if (prCommits.length <= 1) {
        return {
          method: 'commit-tree-structure',
          confidence: 0.1,
          isSquash: false,
          reasoning: 'Insufficient commits for tree structure analysis',
          evidence: { commitCount: prCommits.length },
          weight: 0.1
        };
      }

      // Get detailed commit information including tree data
      const mergeCommitDetails = await this.octokit.repos.getCommit({
        owner: repoOwner,
        repo: repoName,
        ref: mergeCommit.sha
      });

      // Check if merge commit has only one parent (squash indicator)
      const hasOneParent = mergeCommit.parents.length === 1;

      // Check if merge commit tree differs significantly from last PR commit
      const lastPrCommit = prCommits[prCommits.length - 1];
      let treeDifference = false;

      try {
        const lastPrCommitDetails = await this.octokit.repos.getCommit({
          owner: repoOwner,
          repo: repoName,
          ref: lastPrCommit.sha
        });

        treeDifference = mergeCommitDetails.data.commit.tree.sha !== lastPrCommitDetails.data.commit.tree.sha;
      } catch (error: any) {
        // If we can't get the commit details, assume there's a difference
        treeDifference = true;
      }

      const evidence = {
        hasOneParent,
        treeDifference,
        mergeCommitTreeSha: mergeCommitDetails.data.commit.tree.sha,
        parentCount: mergeCommit.parents.length
      };

      const isSquash = hasOneParent && treeDifference && prCommits.length > 1;
      const confidence = isSquash ? 0.8 : 0.3;

      return {
        method: 'commit-tree-structure',
        confidence,
        isSquash,
        reasoning: isSquash
          ? 'Tree structure indicates squash: single parent with different tree structure'
          : 'Tree structure does not indicate squash merge',
        evidence,
        weight: 0.1
      };

    } catch (error: any) {
      return {
        method: 'commit-tree-structure',
        confidence: 0.0,
        isSquash: false,
        reasoning: `Tree structure analysis failed: ${error.message}`,
        evidence: { error: error.message },
        weight: 0.1
      };
    }
  }

  /**
   * Method 5: GitHub Events API Integration
   *
   * Uses GitHub Events API to detect merge events with squash strategy.
   * This provides direct evidence of squash operations when available.
   */
  private async detectViaGitHubEventsAPI(
    prData: PullRequestData,
    repoOwner: string,
    repoName: string
  ): Promise<SquashDetectionResult> {
    try {
      // Look for merge events in timeline events
      const mergeEvents = prData.timelineEvents?.filter(event =>
        event.event === 'merged' || event.event === 'closed'
      ) || [];

      // Try to get more detailed event information
      let squashEventFound = false;
      let mergeStrategy = 'unknown';

      for (const event of mergeEvents) {
        if (event.event === 'merged') {
          // Check if event contains merge strategy information
          const eventData = event as any;
          if (eventData.merge_strategy) {
            mergeStrategy = eventData.merge_strategy;
            squashEventFound = mergeStrategy === 'squash';
            break;
          }
        }
      }

      const evidence = {
        mergeEventsFound: mergeEvents.length,
        mergeStrategy,
        squashEventFound,
        timelineEventsCount: prData.timelineEvents?.length || 0
      };

      const confidence = squashEventFound ? 0.95 : (mergeEvents.length > 0 ? 0.2 : 0.1);

      return {
        method: 'github-events-api',
        confidence,
        isSquash: squashEventFound,
        reasoning: squashEventFound
          ? 'GitHub Events API confirms squash merge strategy'
          : 'GitHub Events API does not indicate squash merge',
        evidence,
        weight: 0.3
      };

    } catch (error: any) {
      return {
        method: 'github-events-api',
        confidence: 0.0,
        isSquash: false,
        reasoning: `GitHub Events API detection failed: ${error.message}`,
        evidence: { error: error.message },
        weight: 0.3
      };
    }
  }

  /**
   * Method 6: Diff Analysis
   *
   * Compares the diff of the merge commit with the combined diffs of PR commits.
   * Squashed commits should have similar overall changes but different commit structure.
   */
  private async detectViaDiffAnalysis(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[],
    repoOwner: string,
    repoName: string
  ): Promise<SquashDetectionResult> {
    try {
      if (prCommits.length <= 1) {
        return {
          method: 'diff-analysis',
          confidence: 0.1,
          isSquash: false,
          reasoning: 'Insufficient commits for diff analysis',
          evidence: { commitCount: prCommits.length },
          weight: 0.05
        };
      }

      // Get the diff stats for the merge commit
      const mergeCommitDiff = await this.octokit.repos.getCommit({
        owner: repoOwner,
        repo: repoName,
        ref: mergeCommit.sha
      });

      const mergeStats = mergeCommitDiff.data.stats;

      // Calculate combined stats from PR commits (simplified approach)
      let totalAdditions = 0;
      let totalDeletions = 0;
      let totalChanges = 0;

      // For performance, only analyze first few commits
      for (const commit of prCommits.slice(0, 3)) {
        try {
          const commitDiff = await this.octokit.repos.getCommit({
            owner: repoOwner,
            repo: repoName,
            ref: commit.sha
          });

          if (commitDiff.data.stats) {
            totalAdditions += commitDiff.data.stats.additions || 0;
            totalDeletions += commitDiff.data.stats.deletions || 0;
            totalChanges += commitDiff.data.stats.total || 0;
          }
        } catch (error: any) {
          // Skip commits we can't analyze
        }
      }

      // Compare merge commit stats with combined PR commit stats
      const additionsDiff = Math.abs((mergeStats?.additions || 0) - totalAdditions);
      const deletionsDiff = Math.abs((mergeStats?.deletions || 0) - totalDeletions);
      const totalDiff = Math.abs((mergeStats?.total || 0) - totalChanges);

      // If stats are similar, it might indicate a squash
      const statsThreshold = Math.max(totalChanges * 0.1, 10); // 10% threshold or minimum 10 lines
      const statsSimilar = totalDiff <= statsThreshold;

      const evidence = {
        mergeStats,
        combinedPrStats: { additions: totalAdditions, deletions: totalDeletions, total: totalChanges },
        additionsDiff,
        deletionsDiff,
        totalDiff,
        statsSimilar,
        statsThreshold
      };

      const isSquash = statsSimilar && prCommits.length > 1 && totalChanges > 0;
      const confidence = isSquash ? 0.6 : 0.3;

      return {
        method: 'diff-analysis',
        confidence,
        isSquash,
        reasoning: isSquash
          ? 'Diff analysis indicates squash: merge commit changes similar to combined PR commits'
          : 'Diff analysis does not clearly indicate squash',
        evidence,
        weight: 0.05
      };

    } catch (error: any) {
      return {
        method: 'diff-analysis',
        confidence: 0.0,
        isSquash: false,
        reasoning: `Diff analysis failed: ${error.message}`,
        evidence: { error: error.message },
        weight: 0.05
      };
    }
  }

  /**
   * Method 7: Legacy Heuristics (for backward compatibility)
   *
   * The original simple detection method for comparison and fallback.
   */
  private detectViaLegacyHeuristics(
    mergeCommit: GitHubCommit,
    prCommits: GitHubCommit[]
  ): SquashDetectionResult {
    const hasOneParent = mergeCommit.parents.length === 1;
    const hasMultiplePrCommits = prCommits.length > 1;
    const hasSquashKeywords = this.analyzeSquashIndicatorsInMessage(mergeCommit.commit.message);

    const evidence = {
      hasOneParent,
      hasMultiplePrCommits,
      hasSquashKeywords,
      prCommitCount: prCommits.length,
      parentCount: mergeCommit.parents.length
    };

    const isSquash = hasOneParent && hasMultiplePrCommits;
    const confidence = isSquash ? (hasSquashKeywords ? 0.7 : 0.5) : 0.2;

    return {
      method: 'legacy-heuristics',
      confidence,
      isSquash,
      reasoning: isSquash
        ? 'Legacy heuristics indicate squash: single parent with multiple PR commits'
        : 'Legacy heuristics do not indicate squash',
      evidence,
      weight: 0.1
    };
  }

  /**
   * Cross-validation method that combines results from multiple detection methods
   */
  private crossValidateResults(results: SquashDetectionResult[]): {
    isSquash: boolean;
    confidence: number;
    methods: SquashDetectionResult[];
    reasoning: string;
  } {
    if (results.length === 0) {
      return {
        isSquash: false,
        confidence: 0,
        methods: [],
        reasoning: 'No detection methods were executed'
      };
    }

    // Calculate weighted confidence score
    const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
    const weightedSquashScore = results.reduce((sum, result) => {
      return sum + (result.isSquash ? result.confidence * result.weight : 0);
    }, 0);
    const weightedNonSquashScore = results.reduce((sum, result) => {
      return sum + (!result.isSquash ? result.confidence * result.weight : 0);
    }, 0);

    const finalConfidence = Math.max(weightedSquashScore, weightedNonSquashScore) / totalWeight;
    const isSquash = weightedSquashScore > weightedNonSquashScore;

    // Require minimum confidence threshold
    const meetsThreshold = finalConfidence >= this.config.confidenceThreshold;

    // Generate reasoning
    const positiveResults = results.filter(r => r.isSquash);
    const negativeResults = results.filter(r => !r.isSquash);

    let reasoning = `Cross-validation of ${results.length} methods: `;
    reasoning += `${positiveResults.length} indicate squash, ${negativeResults.length} indicate non-squash. `;
    reasoning += `Weighted confidence: ${(finalConfidence * 100).toFixed(1)}%. `;
    reasoning += meetsThreshold ? 'Meets confidence threshold.' : 'Below confidence threshold.';

    return {
      isSquash: isSquash && meetsThreshold,
      confidence: finalConfidence,
      methods: results,
      reasoning
    };
  }
}
