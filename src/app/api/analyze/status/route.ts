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
    const startTime = Date.now();
    
    // Perform basic health checks
    const healthChecks = {
      service: 'healthy',
      database: 'not_applicable', // No database in this service
      github_api: 'unknown', // Would need a test token to verify
      analysis_engine: 'healthy',
      advanced_detection: 'healthy',
    };

    // Test analysis depth manager
    try {
      const testConfig = AnalysisDepthManager.getDefaultConfig('shallow');
      healthChecks.analysis_engine = testConfig ? 'healthy' : 'degraded';
    } catch (error) {
      healthChecks.analysis_engine = 'unhealthy';
    }

    // Test advanced detection algorithms availability
    try {
      const comprehensiveConfig = AnalysisDepthManager.getComprehensiveConfig('shallow');
      healthChecks.advanced_detection = comprehensiveConfig.enabledMethods.length >= 6 ? 'healthy' : 'degraded';
    } catch (error) {
      healthChecks.advanced_detection = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    const overallStatus = Object.values(healthChecks).every(status => 
      status === 'healthy' || status === 'not_applicable' || status === 'unknown'
    ) ? 'healthy' : 'degraded';

    const statusResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      responseTime,
      services: healthChecks,
      features: {
        advancedSquashDetection: true,
        multipleAlgorithms: true,
        confidenceScoring: true,
        crossValidation: true,
        circuitBreaker: true,
        timeoutProtection: true,
        analysisDepthControl: true,
      },
      algorithms: {
        githubApiMergeStrategy: true,
        timestampPatternAnalysis: true,
        authorCommitterDiscrepancy: true,
        commitTreeStructure: true,
        githubEventsApi: true,
        diffAnalysis: true,
        legacyHeuristics: true,
      },
      configuration: {
        defaultAnalysisDepth: 'shallow',
        supportedDepths: ['shallow', 'deep'],
        defaultAdvancedDetection: true,
        maxRecursionDepth: 5,
        timeoutSeconds: 30,
      },
    };

    return NextResponse.json(statusResponse, {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('Status check failed:', error);

    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Status check failed',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
      } : undefined,
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: corsHeaders,
    });
  }
}
