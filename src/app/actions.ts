'use server';

import { z } from 'zod';
import { analyzeCommitLineage } from '@/ai/flows/analyze-commit-lineage';
import { AnalysisDepthManager } from '@/ai/squash-detection/analysis-depth-manager';
import type { AnalysisResult } from '@/lib/types';

const formSchema = z.object({
  githubToken: z.string().min(1, 'GitHub token is required.'),
  repoOwner: z.string().min(1, 'Repository owner is required.'),
  repoName: z.string().min(1, 'Repository name is required.'),
  pullRequestNumber: z.coerce.number().int().positive('PR number must be a positive integer.'),
  squashAnalysisDepth: z.enum(['shallow', 'deep']).default('shallow'),
  enableAdvancedDetection: z.coerce.boolean().default(true),
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
      squashAnalysisDepth: formData.get('squashAnalysisDepth') || 'shallow',
      enableAdvancedDetection: formData.get('enableAdvancedDetection'),
    });

    if (!validatedFields.success) {
      return {
        error: validatedFields.error.errors.map((e) => e.message).join(', '),
      };
    }

    const {
      githubToken,
      repoOwner,
      repoName,
      pullRequestNumber,
      squashAnalysisDepth,
      enableAdvancedDetection
    } = validatedFields.data;

    // Create squash analysis configuration
    const squashAnalysisConfig = enableAdvancedDetection
      ? AnalysisDepthManager.getComprehensiveConfig(squashAnalysisDepth)
      : AnalysisDepthManager.getPerformanceConfig(squashAnalysisDepth);

    // This now calls the enhanced lineage builder with advanced squash detection.
    const commitLineage = await analyzeCommitLineage({
      repoOwner,
      repoName,
      pullRequestNumber,
      githubToken,
      squashAnalysisConfig,
    });

    return { result: { commitLineage } };

  } catch (error: any) {
    console.error(error);
    // Sanitize error message for user
    let errorMessage = 'An unexpected error occurred.';
    if (error.status === 404) {
      errorMessage = "Repository or Pull Request not found. Please check your inputs.";
    } else if (error.status === 401) {
      errorMessage = "Invalid GitHub token. Please check your token and permissions.";
    } else if (error.status === 403) {
      errorMessage = "GitHub API rate limit exceeded. Please try again later or use a different token.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { error: errorMessage };
  }
}
