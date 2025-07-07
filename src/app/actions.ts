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

    // Fetch PR data for description
    const prDetails = await octokit.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullRequestNumber,
    });
    const pullRequestDescription = prDetails.data.body || '';

    // Step 1: Extract GitHub Data
    const githubData = await extractGitHubData({
      githubToken,
      repoOwner,
      repoName,
      pullRequestNumber,
    });
    
    if (!githubData.commits || githubData.commits.length === 0) {
      return { error: "No commits found for this Pull Request." };
    }

    const commitHistory = githubData.commits
      .map(c => `Commit: ${c.sha}\nAuthor: ${c.commit.author.name} <${c.commit.author.email}>\nDate: ${c.commit.author.date}\nParents: ${c.parents.map(p => p.sha).join(', ')}\nMessage: ${c.commit.message}\n`)
      .join('\n---\n');

    // Step 2 & 3: Calculate LTC and Analyze Lineage in parallel
    const [ltc, commitLineage] = await Promise.all([
      calculateLTC({
        commitHistory,
        pullRequestDescription,
      }),
      analyzeCommitLineage({
        repoOwner,
        repoName,
        pullRequestNumber,
        githubToken,
        commitHistory,
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
