'use server';

import { Octokit } from '@octokit/rest';
import type { AnalyzeCommitLineageOutput, CommitNode } from '@/lib/types';
import { getPullRequestData } from '@/ai/tools/github-tools';

function parsePrNumberFromMessage(message: string): number | null {
  const match = message.match(/\(#(\d+)\)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
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
 * This is a deterministic replacement for the previous AI-based approach.
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

  while (prQueue.length > 0) {
    const pullRequestNumber = prQueue.shift()!; 
    if (processedPRs.has(pullRequestNumber)) {
      continue;
    }

    processedPRs.add(pullRequestNumber);
    prsAnalyzed.push(pullRequestNumber);

    const prData = await getPullRequestData(octokit, repoOwner, repoName, pullRequestNumber);
    
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
      if (nestedPrNumber && !processedPRs.has(nestedPrNumber)) {
        prQueue.push(nestedPrNumber);
      }
    }

    // Process the merge/squash commit
    if (prData.mergeCommit) {
      const mergeCommit = prData.mergeCommit;
      const mergeCommitSha = mergeCommit.sha;
      
      const nestedPrNumber = parsePrNumberFromMessage(mergeCommit.commit.message);
      if (nestedPrNumber && !processedPRs.has(nestedPrNumber)) {
        prQueue.push(nestedPrNumber);
      }
      
      const parents = mergeCommit.parents.map(p => p.sha);
      let type = 'Merge Commit';
      
      const isSquash = !prData.prCommits.some(c => c.sha === mergeCommitSha) && nestedPrNumber;
      
      if (isSquash) {
        type = 'Squash';
        const lastFeatureCommit = prData.prCommits[prData.prCommits.length - 1];
        if (lastFeatureCommit && !parents.includes(lastFeatureCommit.sha)) {
          parents.push(lastFeatureCommit.sha);
        }
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
          type: type,
        });
      } else {
        const existingNode = nodes.get(mergeCommitSha)!;
        existingNode.branch = prData.prDetails.base.ref;
        existingNode.type = type;
        existingNode.parents = parents;
      }
    }
  }

  const summary = `Analyzed ${prsAnalyzed.length} pull request(s): #${prsAnalyzed.join(', #')}. Found ${nodes.size} unique commits. This graph shows how commits from feature branches were merged or squashed.`;

  return {
    summary,
    nodes: Array.from(nodes.values()),
  };
}
