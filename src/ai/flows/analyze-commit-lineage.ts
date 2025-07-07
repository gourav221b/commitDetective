// This is a server-side file.
'use server';

/**
 * @fileOverview Analyzes the commit history of a pull request to trace the lineage of commits, recursively handling nested PRs.
 *
 * - analyzeCommitLineage - A function that analyzes the commit lineage.
 * - AnalyzeCommitLineageInput - The input type for the analyzeCommitLineage function.
 * - AnalyzeCommitLineageOutput - The return type for the analyzeCommitLineage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getPullRequestData} from '@/ai/tools/github-tools';

const AnalyzeCommitLineageInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  pullRequestNumber: z.number().describe('The initial pull request number to start the analysis from.'),
  githubToken: z.string().describe('The GitHub token for authentication.'),
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
    summary: z.string().describe('A high-level text summary of the commit lineage, explaining key events like squashes or rebases, and mentioning all PRs that were analyzed.'),
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
  tools: [getPullRequestData],
  prompt: `You are a Git detective, specializing in recursively tracing commit history across multiple nested pull requests. Your mission is to build a complete and accurate commit lineage graph.

You have access to a powerful tool: \`getPullRequestData\`.

Your Process:
1.  **Start Exploration**: Begin with the initial PR number provided (PR {{{pullRequestNumber}}}). Use the \`getPullRequestData\` tool to fetch its data. Maintain a list of PR numbers you have already processed to avoid infinite loops.
2.  **Recursive Analysis**:
    *   Examine each commit from the tool's response.
    *   Pay close attention to merge/squash commit messages. They often contain references to the original PR in the format \`(#<PR_NUMBER>)\`.
    *   If you find a commit that squashes or merges another PR, and you haven't processed that PR number yet, you **MUST** call \`getPullRequestData\` for that new PR number to get its underlying commits.
    *   Continue this recursive process until no new, unprocessed PRs are found.
3.  **Build the Lineage Graph**:
    *   Collect all unique commits from all the tool calls you made.
    *   For each commit, create a \`node\` object. If a commit author is not available, use the committer's name or 'N/A'. Ensure every node has its full SHA, a 7-character short SHA, message, author, date, and its correct parent SHAs.
    *   **Crucially handle squash merges**: A squash merge commit on a target branch (e.g., \`main\`) breaks the direct git parentage to the feature branch commits. To represent this flow visually, you must manually add the SHA of the **last commit from the squashed feature branch** as a parent to the squash merge commit's node in the \`parents\` array. This creates the visual link in the tree.
    *   Identify the branch for each commit (e.g., "feature/pr-123", "main"). Commits from \`prCommits\` belong to a feature branch, and the \`mergeCommit\` belongs to the target branch.
    *   Assign a \`type\` to each node: "Squash", "Merge Commit", or "Commit".
4.  **Final Output**:
    *   Combine all collected nodes into a single, flat \`nodes\` array. The client will build the tree from this array using the parent relationships.
    *   Write a comprehensive \`summary\` explaining the lineage you discovered. Mention all the PR numbers you analyzed and describe the key events, especially how different branches were squashed or merged.

Your final output must be a single JSON object matching the output schema.
`,
});

const analyzeCommitLineageFlow = ai.defineFlow(
  {
    name: 'analyzeCommitLineageFlow',
    inputSchema: AnalyzeCommitLineageInputSchema,
    outputSchema: AnalyzeCommitLineageOutputSchema,
  },
  async input => {
    // The model will use the tool to fetch all necessary data.
    const {output} = await analyzeCommitLineagePrompt(input);
    return output!;
  }
);
