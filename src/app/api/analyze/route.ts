import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeCommitLineage } from '@/ai/flows/analyze-commit-lineage';
import { AnalysisDepthManager } from '@/ai/squash-detection/analysis-depth-manager';
import type { AnalysisResult } from '@/lib/types';

export const runtime = 'edge';

// Request validation schema
const analyzeRequestSchema = z.object({
  githubToken: z.string().min(1, 'GitHub token is required.'),
  repoOwner: z.string().min(1, 'Repository owner is required.'),
  repoName: z.string().min(1, 'Repository name is required.'),
  pullRequestNumber: z.number().int().positive('PR number must be a positive integer.'),
  squashAnalysisDepth: z.enum(['shallow', 'deep']).default('shallow'),
  enableAdvancedDetection: z.boolean().default(true),
});

// Response types
interface SuccessResponse {
  success: true;
  data: AnalysisResult;
  metadata?: {
    processingTime: number;
    timestamp: string;
    version: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const body = await request.json();

    const validatedFields = analyzeRequestSchema.safeParse(body);

    if (!validatedFields.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Validation failed',
        details: validatedFields.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(errorResponse, {
        status: 400,
        headers: corsHeaders,
      });
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

    console.log(`API: Starting analysis for ${repoOwner}/${repoName}#${pullRequestNumber} with ${squashAnalysisDepth} depth`);

    // Perform the analysis
    const result = await analyzeCommitLineage({
      githubToken,
      repoOwner,
      repoName,
      pullRequestNumber,
      squashAnalysisConfig
    });

    const processingTime = Date.now() - startTime;

    const successResponse: SuccessResponse = {
      success: true,
      data: {
        commitLineage: result,
        ...result
      },
      metadata: {
        processingTime,
        timestamp: new Date().toISOString(),
        version: '2.0.0', // Enhanced version with advanced detection
      },
    };

    console.log(`API: Analysis completed in ${processingTime}ms`);

    return NextResponse.json(successResponse, {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    console.error('API: Analysis failed:', error);

    const errorResponse: ErrorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        processingTime,
      } : undefined,
      timestamp: new Date().toISOString(),
    };

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (error.message?.includes('Not Found') || error.message?.includes('404')) {
      statusCode = 404;
    } else if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
      statusCode = 401;
    } else if (error.message?.includes('rate limit') || error.message?.includes('403')) {
      statusCode = 429;
    }

    return NextResponse.json(errorResponse, {
      status: statusCode,
      headers: corsHeaders,
    });
  }
}

// GET method for endpoint documentation
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/analyze',
    method: 'POST',
    description: 'Analyze commit lineage and detect squash commits in a GitHub pull request',
    version: '2.0.0',
    features: [
      'Advanced squash detection with 6+ algorithms',
      'Configurable analysis depth (shallow/deep)',
      'Cross-validation with confidence scoring',
      'Circuit breaker protection and timeout handling',
      'Comprehensive error handling',
    ],
    requestSchema: {
      githubToken: 'string (required) - GitHub personal access token',
      repoOwner: 'string (required) - Repository owner/organization name',
      repoName: 'string (required) - Repository name',
      pullRequestNumber: 'number (required) - Pull request number',
      squashAnalysisDepth: 'string (optional) - "shallow" or "deep", defaults to "shallow"',
      enableAdvancedDetection: 'boolean (optional) - Enable advanced detection algorithms, defaults to true',
    },
    responseSchema: {
      success: 'boolean - Indicates if the request was successful',
      data: 'AnalysisResult (on success) - Complete analysis results',
      error: 'string (on error) - Error message',
      details: 'any (on error, dev only) - Additional error details',
      metadata: 'object (on success) - Processing metadata',
    },
    examples: {
      request: {
        githubToken: 'ghp_...',
        repoOwner: 'vercel',
        repoName: 'next.js',
        pullRequestNumber: 12345,
        squashAnalysisDepth: 'shallow',
        enableAdvancedDetection: true,
      },
    },
  };

  return NextResponse.json(documentation, {
    status: 200,
    headers: corsHeaders,
  });
}
