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

const AnalyzeCommitLineageOutputSchema = z.object({
  commitLineage: z.string().describe('The lineage of the commits in the pull request, accounting for squashes, rebases, and force pushes.'),
  visualizationData: z.string().optional().describe('Data for visualizing the commit path traces (optional).'),
});

export type AnalyzeCommitLineageOutput = z.infer<typeof AnalyzeCommitLineageOutputSchema>;

export async function analyzeCommitLineage(input: AnalyzeCommitLineageInput): Promise<AnalyzeCommitLineageOutput> {
  return analyzeCommitLineageFlow(input);
}

const analyzeCommitLineagePrompt = ai.definePrompt({
  name: 'analyzeCommitLineagePrompt',
  input: {schema: AnalyzeCommitLineageInputSchema},
  output: {schema: AnalyzeCommitLineageOutputSchema},
  prompt: `You are a Git expert, skilled in tracing commit history, even through squashes, rebases, and force pushes. Analyze the following commit history from a GitHub pull request and determine the lineage of each commit. Provide a detailed explanation of the commit lineage, considering potential squashes, rebases and force-pushes.

Repository Owner: {{{repoOwner}}}
Repository Name: {{{repoName}}}
Pull Request Number: {{{pullRequestNumber}}}
Commit History: {{{commitHistory}}}

Consider the following:

*   **Squashed Commits:** Identify commits that were squashed into a single commit during the pull request process.
*   **Rebased Commits:** Detect commits that were rebased onto the target branch.
*   **Force Pushes:** Account for any force pushes that may have altered the commit history.

Return the commit lineage for each commit in the pull request. If visualization data can be returned, please do so.
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
