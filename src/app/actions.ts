'use server';

import { z } from 'zod';
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

    // The main flow now orchestrates everything, including data fetching via tools.
    const commitLineage = await analyzeCommitLineage({
      repoOwner,
      repoName,
      pullRequestNumber,
      githubToken,
    });

    // The result structure is now simpler and focused on the lineage.
    return { result: { commitLineage } };

  } catch (error: any) {
    console.error(error);
    // Sanitize error message for user
    let errorMessage = 'An unexpected error occurred.';
    if (error.status === 404) {
      errorMessage = "Repository or Pull Request not found. Please check your inputs.";
    } else if (error.status === 401) {
      errorMessage = "Invalid GitHub token. Please check your token and permissions.";
    } else if (error instanceof Error) {
      if (error.message.includes('NOT_FOUND')) {
        errorMessage = "Repository or Pull Request not found. Please check your inputs and the tool's permissions.";
      } else if (error.message.includes('UNAUTHENTICATED') || error.message.includes('401')) {
        errorMessage = "Invalid GitHub token. Please check your token and permissions.";
      } else {
        errorMessage = "An AI-related error occurred. The model may have been unable to process the request. Please check the console for more details.";
      }
    }
    return { error: errorMessage };
  }
}
