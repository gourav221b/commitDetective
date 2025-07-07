// This is a server-side file.
'use server';

/**
 * @fileOverview Analyzes the commit history of a pull request to trace the lineage of commits.
 *
 * - analyzeCommitLineage - A function that analyzes the commit lineage.
 * - AnalyzeCommitLineageInput - The input type for the analyzeCommitLineage function.
 * - AnalyzeCommitLineageOutput - The return type for the analyzeCommitLineage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCommitLineageInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  pullRequestNumber: z.number().describe('The pull request number.'),
  githubToken: z.string().describe('The GitHub token for authentication.'),
  commitHistory: z.string().describe('The commit history of the pull request.'),
});
export type AnalyzeCommitLineageInput = z.infer<typeof AnalyzeCommitLineageInputSchema>;

const CommitNodeSchema = z.object({
  sha: z.string().describe('The full SHA of the commit.'),
  shortSha: z.string().describe('The first 7 characters of the SHA.'),
  message: z.string().describe('The commit message.'),
  author: z.string().describe('The name of the commit author.'),
  date: z.string().describe('The date of the commit in ISO 8601 format.'),
  parents: z.array(z.string()).describe('An array of parent commit SHAs.'),
  branch: z.string().optional().describe('The branch this commit belongs to, e.g., "feature/new-login" or "main".'),
  type: z.string().optional().describe('Type of event, e.g., "Merge Commit", "Squash", "Rebase", "Force Push", or "Commit".')
});

const AnalyzeCommitLineageOutputSchema = z.object({
    summary: z.string().describe('A high-level text summary of the commit lineage, explaining key events like squashes or rebases.'),
    nodes: z.array(CommitNodeSchema).describe('A flat list of all relevant commits as nodes for building a visualization. The client application will use the `parents` array within each node to reconstruct the tree structure.'),
});

export type AnalyzeCommitLineageOutput = z.infer<typeof AnalyzeCommitLineageOutputSchema>;

export async function analyzeCommitLineage(input: AnalyzeCommitLineageInput): Promise<AnalyzeCommitLineageOutput> {
  return analyzeCommitLineageFlow(input);
}

const analyzeCommitLineagePrompt = ai.definePrompt({
  name: 'analyzeCommitLineagePrompt',
  input: {schema: AnalyzeCommitLineageInputSchema},
  output: {schema: AnalyzeCommitLineageOutputSchema},
  prompt: `You are a Git expert, skilled in tracing commit history across branches, even through complex events like squashes, rebases, and force pushes. Your task is to analyze the commit history of a GitHub pull request and provide a structured representation of the commit lineage suitable for visualization as a tree.

Repository Owner: {{{repoOwner}}}
Repository Name: {{{repoName}}}
Pull Request Number: {{{pullRequestNumber}}}
Commit History: {{{commitHistory}}}

Analyze the provided commit history, which includes commit SHAs, authors, dates, messages, and parent SHAs. Your goal is to trace the full path of each commit from its creation on a feature branch to its eventual merge into the main branch.

Instructions:
1.  **Identify Branches**: Determine which commits belong to the feature branch and which belong to the target branch (e.g., 'main' or 'develop').
2.  **Detect Key Events**: Identify and label significant events such as merge commits, squashed commits, rebased commits, and force pushes. Assign one of the following types: "Merge Commit", "Squash", "Rebase", "Force Push", or "Commit".
3.  **Construct Nodes**: For each relevant commit, create a node object with its full SHA, a 7-character short SHA, the full commit message, the author's name, the commit date, an array of parent SHAs, and the branch it belongs to.
4.  **Provide Summary**: Write a brief, high-level summary of the analysis, explaining the key events you found and the overall flow of changes.

The output must be a JSON object matching the provided schema, containing a 'summary' string and a 'nodes' array. The 'nodes' array should be a flat list of all commits involved in the lineage.`,
});

const analyzeCommitLineageFlow = ai.defineFlow(
  {
    name: 'analyzeCommitLineageFlow',
    inputSchema: AnalyzeCommitLineageInputSchema,
    outputSchema: AnalyzeCommitLineageOutputSchema,
  },
  async input => {
    const {output} = await analyzeCommitLineagePrompt(input);
    return output!;
  }
);
