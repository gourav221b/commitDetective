'use server';

/**
 * @fileOverview A Genkit tool for fetching data from GitHub.
 *
 * - getPullRequestData - A tool that fetches details, commits, and merge commit for a PR.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Octokit} from '@octokit/rest';

const GitHubCommitSchema = z.object({
  sha: z.string().describe('The SHA of the commit.'),
   author: z.object({
    login: z.string().describe("The GitHub login of the author."),
  }).nullable(),
  commit: z.object({
    author: z.object({
      name: z.string().describe("The name of the author."),
      email: z.string().describe("The email of the author."),
      date: z.string().describe("The date of the commit."),
    }).nullable(),
    message: z.string().describe('The commit message.'),
    tree: z.object({
        sha: z.string()
    }),
    comment_count: z.number(),
  }),
  parents: z.array(z.object({
    sha: z.string().describe('The SHA of the parent commit.'),
  })).describe('The parent commits of this commit.'),
});

const PullRequestDetailsSchema = z.object({
    url: z.string(),
    id: z.number(),
    number: z.number(),
    state: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    merged: z.boolean(),
    merge_commit_sha: z.string().nullable(),
});

export const getPullRequestData = ai.defineTool(
  {
    name: 'getPullRequestData',
    description: 'Fetches detailed information for a specific GitHub Pull Request, including its original commits and the final merge commit if it exists. Call this tool for each PR you need to analyze, including nested PRs found within squash commit messages.',
    inputSchema: z.object({
      repoOwner: z.string().describe('The owner of the GitHub repository.'),
      repoName: z.string().describe('The name of the GitHub repository.'),
      pullRequestNumber: z.number().describe('The pull request number.'),
      githubToken: z.string().describe('The GitHub token for authentication.'),
    }),
    outputSchema: z.object({
      prDetails: PullRequestDetailsSchema,
      prCommits: z.array(GitHubCommitSchema),
      mergeCommit: GitHubCommitSchema.nullable(),
    }),
  },
  async ({repoOwner, repoName, pullRequestNumber, githubToken}) => {
    const octokit = new Octokit({auth: githubToken});

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
    let mergeCommit = null;
    if (prDetailsResponse.data.merged && prDetailsResponse.data.merge_commit_sha) {
        try {
            const commitData = await octokit.repos.getCommit({
                owner: repoOwner,
                repo: repoName,
                ref: prDetailsResponse.data.merge_commit_sha,
            });
            mergeCommit = commitData.data as any; // Cast to any to avoid schema mismatch with octokit
        } catch (e) {
            console.warn(`Could not fetch merge commit ${prDetailsResponse.data.merge_commit_sha}`, e);
        }
    }

    return {
      prDetails: prDetailsResponse.data as any, // Cast to any to avoid schema mismatch with octokit
      prCommits: prCommitsResponse.data as any, // Cast to any to avoid schema mismatch with octokit
      mergeCommit: mergeCommit,
    };
  }
);
