import { NextResponse } from 'next/server';
import { AnalysisDepthManager } from '@/ai/squash-detection/analysis-depth-manager';

export const runtime = 'edge';

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
  try {
    // Get all available configurations
    const defaultConfig = AnalysisDepthManager.getDefaultConfig('shallow');
    const performanceConfig = AnalysisDepthManager.getPerformanceConfig('shallow');
    const comprehensiveConfig = AnalysisDepthManager.getComprehensiveConfig('shallow');

    const configResponse = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),

      // Analysis depth options
      analysisDepth: {
        options: ['shallow', 'deep'],
        default: 'shallow',
        descriptions: {
          shallow: 'Expand only the immediate squash commit (faster)',
          deep: 'Recursively expand all nested squashed PRs (comprehensive)',
        },
      },

      // Advanced detection options
      advancedDetection: {
        default: true,
        description: 'Enable multiple sophisticated algorithms for higher accuracy',
      },

      // Available detection algorithms
      algorithms: {
        githubApiMergeStrategy: {
          name: 'GitHub API Merge Strategy Analysis',
          confidence: 0.95,
          description: 'Uses GitHub PR merge information and API data',
        },
        timestampPatternAnalysis: {
          name: 'Commit Timestamp Pattern Analysis',
          confidence: 0.7,
          description: 'Detects clustered timestamps indicating squash operations',
        },
        authorCommitterDiscrepancy: {
          name: 'Author vs Committer Discrepancy Detection',
          confidence: 0.6,
          description: 'Analyzes differences between commit author and committer',
        },
        commitTreeStructure: {
          name: 'Commit Tree Structure Analysis',
          confidence: 0.8,
          description: 'Analyzes git tree structure and parent relationships',
        },
        githubEventsApi: {
          name: 'GitHub Events API Integration',
          confidence: 0.95,
          description: 'Uses GitHub timeline events to detect merge strategies',
        },
        diffAnalysis: {
          name: 'Diff Analysis',
          confidence: 0.6,
          description: 'Compares merge commit changes with combined PR commit changes',
        },
        legacyHeuristics: {
          name: 'Legacy Heuristics',
          confidence: 0.5,
          description: 'Maintains backward compatibility with existing detection',
        },
      },

      // Configuration presets
      presets: {
        default: {
          name: 'Default Configuration',
          description: 'Balanced performance and accuracy',
          enabledMethods: defaultConfig.enabledMethods,
          confidenceThreshold: defaultConfig.confidenceThreshold,
          crossValidation: true,
        },
        performance: {
          name: 'Performance Configuration',
          description: 'Faster analysis with fewer methods',
          enabledMethods: performanceConfig.enabledMethods,
          confidenceThreshold: performanceConfig.confidenceThreshold,
          crossValidation: true,
        },
        comprehensive: {
          name: 'Comprehensive Configuration',
          description: 'Maximum accuracy with all methods enabled',
          enabledMethods: comprehensiveConfig.enabledMethods,
          confidenceThreshold: comprehensiveConfig.confidenceThreshold,
          crossValidation: true,
        },
      },

      // System limits and constraints
      limits: {
        maxRecursionDepth: 5,
        timeoutSeconds: 30,
        maxCommitsPerAnalysis: 1000,
        maxPRsPerDeepAnalysis: 50,
      },

      // Cross-validation settings
      crossValidation: {
        enabled: true,
        minimumMethods: 2,
        weightedScoring: true,
        confidenceThresholds: {
          low: 0.3,
          medium: 0.6,
          high: 0.8,
        },
      },

      // Error handling configuration
      errorHandling: {
        circuitBreaker: true,
        retryAttempts: 3,
        backoffStrategy: 'exponential',
        gracefulDegradation: true,
      },

      // API usage guidelines
      usage: {
        rateLimit: 'No specific rate limit, but GitHub API limits apply',
        authentication: 'GitHub personal access token required',
        permissions: 'Repository read access required',
        bestPractices: [
          'Use shallow analysis for quick results',
          'Use deep analysis for comprehensive history reconstruction',
          'Enable advanced detection for higher accuracy',
          'Provide valid GitHub tokens with appropriate permissions',
        ],
      },

      // Response format information
      responseFormat: {
        success: {
          success: true,
          data: 'AnalysisResult object',
          metadata: 'Processing metadata including timing and version',
        },
        error: {
          success: false,
          error: 'Error message string',
          details: 'Additional error details (development only)',
          timestamp: 'ISO timestamp of the error',
        },
      },
    };

    return NextResponse.json(configResponse, {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('Config retrieval failed:', error);

    const errorResponse = {
      success: false,
      error: error.message || 'Failed to retrieve configuration',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
      } : undefined,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
