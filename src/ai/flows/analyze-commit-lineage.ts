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
  commitHistory: z.string().describe('A JSON string containing the commit history. It has two keys: `prCommits` (an array of commit objects from the feature branch) and `mergeCommit` (a single commit object for the final merge/squash commit, or null if not merged).'),
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
  prompt: `You are a Git expert, skilled in tracing commit history. Your task is to analyze the commit history of a GitHub pull request and create a structured representation of the commit lineage for visualization.

You will be given a JSON object in the 'commitHistory' field with two properties:
- \`prCommits\`: An array of commit objects from the original pull request branch.
- \`mergeCommit\`: An object representing the final commit that was merged into the target branch. This can be a regular merge commit or a squash commit.

Repository Owner: {{{repoOwner}}}
Repository Name: {{{repoName}}}
Pull Request Number: {{{pullRequestNumber}}}
Commit History: {{{commitHistory}}}

Instructions:
1.  **Process All Commits**: Create nodes for all commits in both \`prCommits\` and the \`mergeCommit\` (if present). These represent the work done.
2.  **Identify Branches**: Assign commits in \`prCommits\` to a feature branch (e.g., "feature/pr-123"). Assign the \`mergeCommit\` to the main branch (e.g., "main").
3.  **Detect Key Events & Build Lineage**:
    *   **If a \`mergeCommit\` is present**:
        *   **Squash Commit**: If the \`mergeCommit\` has one parent and its message indicates a squash (e.g., contains "Squash merge" or references the PR number), its node \`type\` must be "Squash". A squash breaks the Git parentage. To create a visual link, add the SHA of the **last** commit in the \`prCommits\` array to the \`parents\` array of the \`mergeCommit\` node. This shows that the feature branch work flowed into the squash.
        *   **Merge Commit**: If the \`mergeCommit\` has more than one parent, its node \`type\` must be "Merge Commit". Its parents should correctly link to the tips of the target and feature branches.
    *   **For all other commits**: The \`type\` should be "Commit".
4.  **Construct Nodes**: For each commit, create a node object with its full SHA, a 7-character short SHA, the full commit message, the author's name, the commit date, its actual parent SHAs (with the modification for squashes as described above), the branch, and the event type.
5.  **Provide Summary**: Write a brief, high-level summary of the analysis. Explicitly state if a squash merge occurred and explain that it combined the feature branch commits into a single commit on the main branch.

The output must be a JSON object matching the provided schema, containing a 'summary' string and a flat 'nodes' array.
`,
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
