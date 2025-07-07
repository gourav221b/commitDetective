'use server';

import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { extractGitHubData } from '@/ai/flows/extract-github-data';
import { calculateLTC } from '@/ai/flows/calculate-ltc';
import { analyzeCommitLineage } from '@/ai/flows/analyze-commit-lineage';
import type { AnalysisResult } from '@/lib/types';

const formSchema = z.object({
  githubToken: z.string().min(1, 'GitHub token is required.'),
  repoOwner: z.string().min(1, 'Repository owner is required.'),
  repoName: z.string().min(1, 'Repository name is required.'),
  pullRequestNumber: z.coerce.number().int().positive('PR number must be a positive integer.'),
});

export async function analyzePullRequest(
  prevState: any,
  formData: FormData
): Promise<{ result?: AnalysisResult; error?: string }> {
  try {
    const validatedFields = formSchema.safeParse({
      githubToken: formData.get('githubToken'),
      repoOwner: formData.get('repoOwner'),
      repoName: formData.get('repoName'),
      pullRequestNumber: formData.get('pullRequestNumber'),
    });

    if (!validatedFields.success) {
      return {
        error: validatedFields.error.errors.map((e) => e.message).join(', '),
      };
    }

    const { githubToken, repoOwner, repoName, pullRequestNumber } = validatedFields.data;

    const octokit = new Octokit({ auth: githubToken });

    // Fetch PR details
    const prDetailsResponse = await octokit.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullRequestNumber,
    });
    const prDetails = prDetailsResponse.data;
    const pullRequestDescription = prDetails.body || '';

    // Step 1: Extract GitHub Data (original commits on the PR branch)
    const githubData = await extractGitHubData({
      githubToken,
      repoOwner,
      repoName,
      pullRequestNumber,
    });
    
    if (!githubData.commits || githubData.commits.length === 0) {
      return { error: "No commits found for this Pull Request." };
    }

    // Check if the PR was merged and get the merge commit details
    let mergeCommit = null;
    if (prDetails.merged && prDetails.merge_commit_sha) {
      try {
        const commitData = await octokit.repos.getCommit({
          owner: repoOwner,
          repo: repoName,
          ref: prDetails.merge_commit_sha,
        });
        mergeCommit = commitData.data;
      } catch (e) {
        console.warn(`Could not fetch merge commit ${prDetails.merge_commit_sha}`, e);
        // Continue without it, the analysis will be based on PR commits only
      }
    }

    const commitHistoryForLTC = githubData.commits
      .map(c => `Commit: ${c.sha}\nAuthor: ${c.commit.author.name} <${c.commit.author.email}>\nDate: ${c.commit.author.date}\nMessage: ${c.commit.message}\n`)
      .join('\n---\n');
      
    const commitHistoryForLineage = JSON.stringify({
      prCommits: githubData.commits,
      mergeCommit: mergeCommit,
    });

    // Step 2 & 3: Calculate LTC and Analyze Lineage in parallel
    const [ltc, commitLineage] = await Promise.all([
      calculateLTC({
        commitHistory: commitHistoryForLTC,
        pullRequestDescription,
      }),
      analyzeCommitLineage({
        repoOwner,
        repoName,
        pullRequestNumber,
        githubToken,
        commitHistory: commitHistoryForLineage,
      }),
    ]);

    return { result: { githubData, ltc, commitLineage } };
  } catch (error: any) {
    console.error(error);
    // Sanitize error message for user
    let errorMessage = 'An unexpected error occurred.';
    if (error.status === 404) {
      errorMessage = "Repository or Pull Request not found. Please check your inputs.";
    } else if (error.status === 401) {
      errorMessage = "Invalid GitHub token. Please check your token and permissions.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { error: errorMessage };
  }
}
