import { NextResponse } from 'next/server';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(): Promise<NextResponse> {
  const apiDocumentation = {
    title: 'CommitDetective API Documentation',
    version: '2.0.0',
    description: 'Enhanced squash detection and commit lineage analysis API',
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002',
    
    endpoints: {
      '/api/analyze': {
        method: 'POST',
        description: 'Analyze commit lineage and detect squash commits in a GitHub pull request',
        headers: {
          'Content-Type': 'application/json',
        },
        requestBody: {
          required: true,
          schema: {
            type: 'object',
            properties: {
              githubToken: {
                type: 'string',
                required: true,
                description: 'GitHub personal access token with repository read access',
                example: 'ghp_...',
              },
              repoOwner: {
                type: 'string',
                required: true,
                description: 'Repository owner or organization name',
                example: 'vercel',
              },
              repoName: {
                type: 'string',
                required: true,
                description: 'Repository name',
                example: 'next.js',
              },
              pullRequestNumber: {
                type: 'number',
                required: true,
                description: 'Pull request number to analyze',
                example: 12345,
              },
              squashAnalysisDepth: {
                type: 'string',
                required: false,
                default: 'shallow',
                enum: ['shallow', 'deep'],
                description: 'Analysis depth: shallow (faster) or deep (comprehensive)',
              },
              enableAdvancedDetection: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Enable advanced detection algorithms for higher accuracy',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Analysis completed successfully',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', value: true },
                data: { type: 'object', description: 'Complete AnalysisResult object' },
                metadata: {
                  type: 'object',
                  properties: {
                    processingTime: { type: 'number', description: 'Processing time in milliseconds' },
                    timestamp: { type: 'string', description: 'ISO timestamp' },
                    version: { type: 'string', description: 'API version' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', value: false },
                error: { type: 'string', description: 'Error message' },
                details: { type: 'array', description: 'Validation error details' },
                timestamp: { type: 'string', description: 'ISO timestamp' },
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid GitHub token',
          },
          404: {
            description: 'Not Found - Repository or PR not found',
          },
          429: {
            description: 'Rate Limited - GitHub API rate limit exceeded',
          },
          500: {
            description: 'Internal Server Error',
          },
        },
      },

      '/api/analyze/status': {
        method: 'GET',
        description: 'Check service health and status',
        responses: {
          200: {
            description: 'Service is healthy',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['healthy', 'degraded'] },
                timestamp: { type: 'string' },
                version: { type: 'string' },
                uptime: { type: 'number' },
                responseTime: { type: 'number' },
                services: { type: 'object' },
                features: { type: 'object' },
                algorithms: { type: 'object' },
                configuration: { type: 'object' },
              },
            },
          },
          503: {
            description: 'Service is unhealthy or degraded',
          },
        },
      },

      '/api/analyze/config': {
        method: 'GET',
        description: 'Get available configuration options and algorithm details',
        responses: {
          200: {
            description: 'Configuration retrieved successfully',
            schema: {
              type: 'object',
              properties: {
                version: { type: 'string' },
                analysisDepth: { type: 'object' },
                advancedDetection: { type: 'object' },
                algorithms: { type: 'object' },
                presets: { type: 'object' },
                limits: { type: 'object' },
                crossValidation: { type: 'object' },
                errorHandling: { type: 'object' },
                usage: { type: 'object' },
                responseFormat: { type: 'object' },
              },
            },
          },
        },
      },

      '/api/docs': {
        method: 'GET',
        description: 'Get this API documentation',
        responses: {
          200: {
            description: 'API documentation',
          },
        },
      },
    },

    examples: {
      basicAnalysis: {
        description: 'Basic analysis with default settings',
        request: {
          method: 'POST',
          url: '/api/analyze',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            githubToken: 'ghp_...',
            repoOwner: 'vercel',
            repoName: 'next.js',
            pullRequestNumber: 12345,
          },
        },
      },
      deepAnalysis: {
        description: 'Deep analysis with advanced detection',
        request: {
          method: 'POST',
          url: '/api/analyze',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            githubToken: 'ghp_...',
            repoOwner: 'facebook',
            repoName: 'react',
            pullRequestNumber: 67890,
            squashAnalysisDepth: 'deep',
            enableAdvancedDetection: true,
          },
        },
      },
    },

    features: {
      advancedSquashDetection: 'Multiple sophisticated algorithms for accurate squash detection',
      confidenceScoring: 'Weighted confidence scores for each detection method',
      crossValidation: 'Cross-validation between multiple detection algorithms',
      analysisDepthControl: 'Configurable analysis depth for performance vs completeness',
      circuitBreakerProtection: 'Automatic failure protection and graceful degradation',
      timeoutHandling: 'Request timeout protection to prevent hanging',
      comprehensiveErrorHandling: 'Detailed error responses with appropriate HTTP status codes',
      corsSupport: 'Cross-origin resource sharing for web applications',
    },

    algorithms: {
      count: 7,
      list: [
        'GitHub API Merge Strategy Analysis (95% confidence)',
        'Commit Timestamp Pattern Analysis (70% confidence)',
        'Author vs Committer Discrepancy Detection (60% confidence)',
        'Commit Tree Structure Analysis (80% confidence)',
        'GitHub Events API Integration (95% confidence)',
        'Diff Analysis (60% confidence)',
        'Legacy Heuristics (50% confidence)',
      ],
    },

    authentication: {
      type: 'GitHub Personal Access Token',
      required: true,
      permissions: ['Repository read access'],
      note: 'Token should be included in the githubToken field of the request body',
    },

    rateLimit: {
      note: 'No specific API rate limits, but GitHub API limits apply',
      recommendation: 'Use appropriate delays between requests to avoid GitHub rate limiting',
    },

    support: {
      documentation: 'Available at /api/docs',
      status: 'Available at /api/analyze/status',
      configuration: 'Available at /api/analyze/config',
    },
  };

  return NextResponse.json(apiDocumentation, {
    status: 200,
    headers: corsHeaders,
  });
}
