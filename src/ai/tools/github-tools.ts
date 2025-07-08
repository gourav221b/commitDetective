'use server';

import type { Octokit } from '@octokit/rest';

// Using interfaces derived from Octokit's response types for better accuracy
export interface GitHubCommit {
  sha: string;
  author: {
    login: string;
  } | null;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    } | null;
    committer: {
      name: string;
      email: string;
      date: string;
    } | null;
    message: string;
  };
  parents: {
    sha: string;
  }[];
}

export interface PullRequestDetails {
  merged: boolean;
  merge_commit_sha: string | null;
  head: { ref: string };
  base: { ref: string };
}

export interface PullRequestData {
  prDetails: PullRequestDetails;
  prCommits: GitHubCommit[];
  mergeCommit: GitHubCommit | null;
  timelineEvents?: TimelineEvent[];
  baseCommit?: GitHubCommit;
}

export interface TimelineEvent {
  event: string;
  created_at: string;
  actor?: {
    login: string;
  };
  commit_id?: string;
  commit_url?: string;
}

export async function getPullRequestData(
  octokit: Octokit,
  repoOwner: string,
  repoName: string,
  pullRequestNumber: number
): Promise<PullRequestData> {
  // Fetch PR details
  const prDetailsResponse = await octokit.pulls.get({
    owner: repoOwner,
    repo: repoName,
    pull_number: pullRequestNumber,
  });

  // Fetch commits from the PR branch
  const prCommitsResponse = await octokit.pulls.listCommits({
    owner: repoOwner,
    repo: repoName,
    pull_number: pullRequestNumber,
    per_page: 100, // Max per page
  });

  // Fetch merge commit details if PR was merged
  let mergeCommit: GitHubCommit | null = null;
  if (prDetailsResponse.data.merged && prDetailsResponse.data.merge_commit_sha) {
    try {
      const commitData = await octokit.repos.getCommit({
        owner: repoOwner,
        repo: repoName,
        ref: prDetailsResponse.data.merge_commit_sha,
      });
      mergeCommit = commitData.data as any; // Using 'any' as octokit types can be complex
    } catch (e) {
      console.warn(`Could not fetch merge commit ${prDetailsResponse.data.merge_commit_sha}`, e);
    }
  }

  // Fetch timeline events for rebase detection
  let timelineEvents: TimelineEvent[] = [];
  try {
    const timelineResponse = await octokit.issues.listEventsForTimeline({
      owner: repoOwner,
      repo: repoName,
      issue_number: pullRequestNumber,
      per_page: 100,
    });
    timelineEvents = timelineResponse.data.filter((event: any) =>
      ['head_ref_force_pushed', 'base_ref_changed', 'committed'].includes(event.event)
    ) as TimelineEvent[];
  } catch (e) {
    console.warn(`Could not fetch timeline events for PR #${pullRequestNumber}`, e);
  }

  // Fetch base commit for comparison
  let baseCommit: GitHubCommit | null = null;
  try {
    const baseCommitData = await octokit.repos.getCommit({
      owner: repoOwner,
      repo: repoName,
      ref: prDetailsResponse.data.base.sha,
    });
    baseCommit = baseCommitData.data as any;
  } catch (e) {
    console.warn(`Could not fetch base commit ${prDetailsResponse.data.base.sha}`, e);
  }

  return {
    prDetails: prDetailsResponse.data as any,
    prCommits: prCommitsResponse.data as any,
    mergeCommit: mergeCommit,
    timelineEvents: timelineEvents,
    baseCommit: baseCommit || undefined,
  };
}
