// src/ai/flows/extract-github-data.ts
'use server';

/**
 * @fileOverview Extracts relevant commit data from GitHub using the Octokit SDK, handles pagination, and identifies key events like squashes, rebases, and force pushes.
 *
 * - extractGitHubData - A function that extracts GitHub data based on repository and pull request number.
 * - ExtractGitHubDataInput - The input type for the extractGitHubData function.
 * - ExtractGitHubDataOutput - The return type for the extractGitHubData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Octokit } from '@octokit/rest';

const ExtractGitHubDataInputSchema = z.object({
  githubToken: z.string().describe('The GitHub token for authentication.'),
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  pullRequestNumber: z.number().describe('The pull request number.'),
});
export type ExtractGitHubDataInput = z.infer<typeof ExtractGitHubDataInputSchema>;

const GitHubCommitSchema = z.object({
  sha: z.string().describe('The SHA of the commit.'),
  author: z.object({
    login: z.string().describe('The GitHub login of the author.'),
  }).nullable(),
  commit: z.object({
    author: z.object({
      name: z.string().describe('The name of the author.'),
      email: z.string().describe('The email of the author.'),
      date: z.string().describe('The date of the commit.'),
    }),
    message: z.string().describe('The commit message.'),
  }),
  parents: z.array(z.object({
    sha: z.string().describe('The SHA of the parent commit.'),
  })).describe('The parent commits of this commit.'),
});
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;

const ExtractGitHubDataOutputSchema = z.object({
  commits: z.array(GitHubCommitSchema).describe('The list of commits in the pull request.'),
  analysis: z.string().describe('The analysis of the commit history, identifying squashes, rebases, and force pushes.'),
});
export type ExtractGitHubDataOutput = z.infer<typeof ExtractGitHubDataOutputSchema>;

export async function extractGitHubData(input: ExtractGitHubDataInput): Promise<ExtractGitHubDataOutput> {
  return extractGitHubDataFlow(input);
}

const extractGitHubDataPrompt = ai.definePrompt({
  name: 'extractGitHubDataPrompt',
  input: {
    schema: z.object({
      commits: z.string().describe('The list of commits in the pull request (as a JSON string).'),
    }),
  },
  output: {
    schema: z.object({
      analysis: z.string().describe('The analysis of the commit history, identifying squashes, rebases, and force pushes.'),
    }),
  },
  prompt: `Analyze the following commit history to identify squash commits, rebase commits, and force pushes. Be concise.

Commit History:
{{commits}}`,
});

const extractGitHubDataFlow = ai.defineFlow(
  {
    name: 'extractGitHubDataFlow',
    inputSchema: ExtractGitHubDataInputSchema,
    outputSchema: ExtractGitHubDataOutputSchema,
  },
  async input => {
    const octokit = new Octokit({
      auth: input.githubToken,
    });

    const commits: GitHubCommit[] = [];
    let page = 1;
    while (true) {
      const response = await octokit.pulls.listCommits({
        owner: input.repoOwner,
        repo: input.repoName,
        pull_number: input.pullRequestNumber,
        per_page: 100, // Maximum allowed value
        page: page,
      });

      if (response.data.length === 0) {
        break;
      }

      for (const commit of response.data) {
        commits.push({
          sha: commit.sha,
          author: commit.author,
          commit: commit.commit,
          parents: commit.parents,
        });
      }

      page++;
    }

    const {
      output
    } = await extractGitHubDataPrompt({
      commits: JSON.stringify(commits),
    });

    return {
      commits: commits,
      analysis: output.analysis,
    };
  }
);
