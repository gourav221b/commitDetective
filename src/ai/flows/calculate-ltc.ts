// src/ai/flows/calculate-ltc.ts
'use server';
/**
 * @fileOverview Calculates the Lead Time for Changes (LTC) DORA metric using AI reasoning.
 *
 * - calculateLTC - A function that calculates the LTC.
 * - CalculateLTCInput - The input type for the calculateLTC function.
 * - CalculateLTCOutput - The return type for the calculateLTC function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateLTCInputSchema = z.object({
  commitHistory: z.string().describe('The commit history of the pull request.'),
  pullRequestDescription: z.string().describe('The description of the pull request.'),
});
export type CalculateLTCInput = z.infer<typeof CalculateLTCInputSchema>;

const CalculateLTCOutputSchema = z.object({
  leadTimeForChanges: z.string().describe('The calculated Lead Time for Changes (LTC) in days.'),
  codeCompleteCommit: z.string().describe('The commit that is considered code complete.'),
});
export type CalculateLTCOutput = z.infer<typeof CalculateLTCOutputSchema>;

export async function calculateLTC(input: CalculateLTCInput): Promise<CalculateLTCOutput> {
  return calculateLTCFlow(input);
}

const prompt = ai.definePrompt({
  name: 'calculateLTCPrompt',
  input: {schema: CalculateLTCInputSchema},
  output: {schema: CalculateLTCOutputSchema},
  prompt: `You are a software development expert calculating the Lead Time for Changes (LTC) DORA metric.

  Given the commit history and pull request description, determine the moment when the code was functionally 'code complete'.
  This means the point in time when all of the functional changes were done - before any refactoring, documentation or any changes that were not related to the primary function of the code.

  Calculate the Lead Time for Changes (LTC) between the 'code complete' commit and the pull request merge time. Return the LTC in days.

  Commit History:
  {{commitHistory}}

  Pull Request Description:
  {{pullRequestDescription}}`,
});

const calculateLTCFlow = ai.defineFlow(
  {
    name: 'calculateLTCFlow',
    inputSchema: CalculateLTCInputSchema,
    outputSchema: CalculateLTCOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
