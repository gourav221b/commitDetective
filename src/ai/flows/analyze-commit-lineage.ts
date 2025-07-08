'use server';

import { Octokit } from '@octokit/rest';
import type { AnalyzeCommitLineageOutput, CommitNode } from '@/lib/types';
import { getPullRequestData, GitHubCommit, PullRequestData, TimelineEvent } from '@/ai/tools/github-tools';

/**
 * Creates a promise that rejects after a specified timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Circuit breaker to prevent cascading failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly maxFailures: number;
  private readonly resetTimeoutMs: number;

  constructor(maxFailures = 3, resetTimeoutMs = 60000) {
    this.maxFailures = maxFailures;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open - too many recent failures');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.maxFailures &&
      (Date.now() - this.lastFailureTime) < this.resetTimeoutMs;
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}

function parsePrNumberFromMessage(message: string): number | null {
  const match = message.match(/\(#(\d+)\)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Detects the type of git operation based on commit data and patterns
 */
function detectGitOperation(
  mergeCommit: GitHubCommit,
  prCommits: GitHubCommit[],
  prBranchName: string,
  timelineEvents?: TimelineEvent[]
): { type: string; confidence: number; metadata?: any } {
  const parents = mergeCommit.parents;
  const message = mergeCommit.commit.message;

  // Single parent = squash or rebase
  if (parents.length === 1) {
    // Check for squash indicators
    if (isSquashCommit(mergeCommit, prCommits, message)) {
      return { type: 'Squash', confidence: 0.9, metadata: { originalCommitCount: prCommits.length } };
    }

    // Check for rebase indicators
    const rebaseInfo = detectRebase(mergeCommit, prCommits, timelineEvents);
    if (rebaseInfo.isRebase) {
      return {
        type: rebaseInfo.type,
        confidence: rebaseInfo.confidence,
        metadata: rebaseInfo.metadata
      };
    }

    return { type: 'Fast-Forward', confidence: 0.7 };
  }

  // Multiple parents = merge commit
  if (parents.length > 1) {
    return { type: 'Merge Commit', confidence: 0.95 };
  }

  return { type: 'Unknown', confidence: 0.1 };
}

/**
 * Determines if a commit is a squash commit
 */
function isSquashCommit(
  mergeCommit: GitHubCommit,
  prCommits: GitHubCommit[],
  message: string
): boolean {
  // Squash commits have only one parent and combine multiple commits
  if (mergeCommit.parents.length !== 1) return false;

  // If there are multiple PR commits but only one merge commit, likely squashed
  if (prCommits.length > 1) return true;

  // Check for squash-related keywords in commit message
  const squashKeywords = [
    /squash/i,
    /\(\#\d+\)/,  // PR number in parentheses is common in squash commits
    /^[^:]+:\s*[^:]+$/  // Pattern like "feat: description" common in squash commits
  ];

  return squashKeywords.some(pattern => pattern.test(message));
}

/**
 * Detects rebase operations by analyzing commit patterns and timeline events
 */
function detectRebase(
  mergeCommit: GitHubCommit,
  prCommits: GitHubCommit[],
  timelineEvents?: TimelineEvent[]
): { isRebase: boolean; type: string; confidence: number; metadata?: any } {
  // Check timeline events for force pushes (strong rebase indicator)
  const forcePushEvents = timelineEvents?.filter(event =>
    event.event === 'head_ref_force_pushed'
  ) || [];

  const baseRefChangedEvents = timelineEvents?.filter(event =>
    event.event === 'base_ref_changed'
  ) || [];

  // Force pushes are strong indicators of rebase operations
  if (forcePushEvents.length > 0) {
    // Check for interactive rebase patterns
    if (hasInteractiveRebasePatterns(mergeCommit, prCommits)) {
      return {
        isRebase: true,
        type: 'Interactive Rebase',
        confidence: 0.95,
        metadata: {
          originalCommits: prCommits.length,
          modifiedHistory: true,
          forcePushCount: forcePushEvents.length,
          forcePushDates: forcePushEvents.map(e => e.created_at)
        }
      };
    }

    return {
      isRebase: true,
      type: 'Simple Rebase',
      confidence: 0.9,
      metadata: {
        linearHistory: true,
        baseChanged: baseRefChangedEvents.length > 0,
        forcePushCount: forcePushEvents.length,
        forcePushDates: forcePushEvents.map(e => e.created_at)
      }
    };
  }

  // Check for interactive rebase patterns without force push
  if (hasInteractiveRebasePatterns(mergeCommit, prCommits)) {
    return {
      isRebase: true,
      type: 'Interactive Rebase',
      confidence: 0.7,
      metadata: {
        originalCommits: prCommits.length,
        modifiedHistory: true
      }
    };
  }

  // Check for simple rebase patterns
  if (hasSimpleRebasePatterns(mergeCommit, prCommits)) {
    return {
      isRebase: true,
      type: 'Simple Rebase',
      confidence: 0.6,
      metadata: {
        linearHistory: true,
        baseChanged: baseRefChangedEvents.length > 0
      }
    };
  }

  return { isRebase: false, type: '', confidence: 0 };
}

/**
 * Detects interactive rebase patterns
 */
function hasInteractiveRebasePatterns(
  mergeCommit: GitHubCommit,
  prCommits: GitHubCommit[]
): boolean {
  // Interactive rebase often results in:
  // - Modified commit messages
  // - Reordered commits
  // - Combined commits (squash during rebase)

  const message = mergeCommit.commit.message;

  // Look for signs of commit message modification during interactive rebase
  const interactiveRebaseKeywords = [
    /fixup!/i,
    /squash!/i,
    /amend/i,
    /reword/i
  ];

  return interactiveRebaseKeywords.some(pattern => pattern.test(message));
}

/**
 * Detects simple rebase patterns
 */
function hasSimpleRebasePatterns(
  mergeCommit: GitHubCommit,
  prCommits: GitHubCommit[]
): boolean {
  // Simple rebase typically:
  // - Maintains commit structure but changes base
  // - Results in linear history
  // - May have only one parent (the new base)

  return mergeCommit.parents.length === 1 && prCommits.length >= 1;
}

// This input type is kept for compatibility with the calling action.
export interface AnalyzeCommitLineageInput {
  repoOwner: string;
  repoName: string;
  pullRequestNumber: number;
  githubToken: string;
}

/**
 * Manually builds a commit lineage by recursively fetching pull request data.
 */
export async function analyzeCommitLineage(
  input: AnalyzeCommitLineageInput
): Promise<AnalyzeCommitLineageOutput> {
  const { repoOwner, repoName, pullRequestNumber: initialPullRequestNumber, githubToken } = input;
  const octokit = new Octokit({ auth: githubToken });
  const nodes = new Map<string, CommitNode>();
  const prQueue: number[] = [initialPullRequestNumber];
  const processedPRs = new Set<number>();
  const prsAnalyzed: number[] = [];

  // Initialize circuit breaker and timeout settings
  const circuitBreaker = new CircuitBreaker(3, 60000); // 3 failures, 1 minute reset
  const maxIterations = 50;
  const operationTimeoutMs = 30000; // 30 seconds per operation
  let iterations = 0;

  while (prQueue.length > 0 && iterations < maxIterations) {
    iterations++;
    const pullRequestNumber = prQueue.shift()!;
    if (processedPRs.has(pullRequestNumber)) {
      continue;
    }

    processedPRs.add(pullRequestNumber);
    prsAnalyzed.push(pullRequestNumber);

    try {
      const prData = await circuitBreaker.execute(() =>
        withTimeout(
          getPullRequestData(octokit, repoOwner, repoName, pullRequestNumber),
          operationTimeoutMs
        )
      );

      const prBranchName = prData.prDetails.head.ref;

      // Process all commits from the PR branch
      for (const commit of prData.prCommits) {
        if (nodes.has(commit.sha)) continue;

        nodes.set(commit.sha, {
          sha: commit.sha,
          shortSha: commit.sha.substring(0, 7),
          message: commit.commit.message,
          author: commit.commit.author?.name || 'N/A',
          date: commit.commit.author?.date || new Date().toISOString(),
          parents: commit.parents.map(p => p.sha),
          branch: prBranchName,
          type: 'Commit',
        });

        const nestedPrNumber = parsePrNumberFromMessage(commit.commit.message);
        if (nestedPrNumber && !processedPRs.has(nestedPrNumber) && prQueue.length < 20) {
          prQueue.push(nestedPrNumber);
        }
      }

      // Process the merge/squash commit
      if (prData.mergeCommit) {
        const mergeCommit = prData.mergeCommit;
        const mergeCommitSha = mergeCommit.sha;
        console.log("Processing", prData.mergeCommit.commit.message);

        const nestedPrNumber = parsePrNumberFromMessage(mergeCommit.commit.message);
        if (nestedPrNumber && !processedPRs.has(nestedPrNumber) && prQueue.length < 20) {
          prQueue.push(nestedPrNumber);
        }

        // Use the new git operation detection
        const gitOperation = detectGitOperation(mergeCommit, prData.prCommits, prBranchName, prData.timelineEvents);
        const parents = mergeCommit.parents.map(p => p.sha);

        // For squash commits, establish proper relationships with original commits
        if (gitOperation.type === 'Squash' && prData.prCommits.length > 0) {
          // Add references to the original commits that were squashed
          const originalCommitShas = prData.prCommits.map(c => c.sha);
          // Store metadata about the squash operation
          gitOperation.metadata = {
            ...gitOperation.metadata,
            originalCommits: originalCommitShas,
            squashedFrom: prBranchName
          };
        }

        if (!nodes.has(mergeCommitSha)) {
          nodes.set(mergeCommitSha, {
            sha: mergeCommitSha,
            shortSha: mergeCommitSha.substring(0, 7),
            message: mergeCommit.commit.message,
            author: mergeCommit.commit.author?.name || 'N/A',
            date: mergeCommit.commit.author?.date || new Date().toISOString(),
            parents: parents,
            branch: prData.prDetails.base.ref,
            type: gitOperation.type,
            metadata: gitOperation.metadata,
          });
        } else {
          const existingNode = nodes.get(mergeCommitSha)!;
          existingNode.branch = prData.prDetails.base.ref;
          existingNode.type = gitOperation.type;
          existingNode.parents = parents;
          existingNode.metadata = gitOperation.metadata;
        }
      }
    } catch (error) {
      console.warn(`Failed to process PR #${pullRequestNumber}:`, error);
      // Continue processing other PRs instead of failing completely
    }
  }

  // Generate enhanced summary with git operation statistics
  const operationCounts = Array.from(nodes.values()).reduce((acc, node) => {
    const type = node.type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const operationSummary = Object.entries(operationCounts)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ');

  const summary = `Analyzed ${prsAnalyzed.length} pull request(s): #${prsAnalyzed.join(', #')}. Found ${nodes.size} unique commits including ${operationSummary}. Enhanced detection identifies squash commits, rebases, and merge patterns.`;

  return {
    summary,
    nodes: Array.from(nodes.values()),
  };
}
