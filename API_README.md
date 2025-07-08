# CommitDetective REST API Documentation

## Overview

The CommitDetective REST API provides programmatic access to advanced squash commit detection and commit lineage analysis for GitHub pull requests. This API exposes the same sophisticated detection algorithms used by the web interface, allowing external services to integrate commit analysis functionality.

## Base URL

```
http://localhost:9002/api
```

## Features

- **🔍 Advanced Squash Detection**: 7 sophisticated algorithms with confidence scoring
- **⚖️ Cross-Validation**: Multiple detection methods with weighted scoring
- **📊 Configurable Analysis Depth**: Shallow (fast) or deep (comprehensive) analysis
- **🛡️ Error Protection**: Circuit breakers, timeouts, and graceful degradation
- **🌐 CORS Support**: Cross-origin requests supported
- **📋 Comprehensive Error Handling**: Detailed error responses with appropriate HTTP status codes

## Endpoints

### 1. Analyze Pull Request

**POST** `/api/analyze`

Analyze commit lineage and detect squash commits in a GitHub pull request.

#### Request Body

```json
{
  "githubToken": "ghp_...",                    // Required: GitHub personal access token
  "repoOwner": "vercel",                       // Required: Repository owner/organization
  "repoName": "next.js",                       // Required: Repository name
  "pullRequestNumber": 12345,                  // Required: Pull request number
  "squashAnalysisDepth": "shallow",            // Optional: "shallow" or "deep" (default: "shallow")
  "enableAdvancedDetection": true              // Optional: Enable advanced algorithms (default: true)
}
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "commits": [...],                          // Array of analyzed commits
    "pullRequest": {...},                      // PR metadata
    "analysis": {...}                          // Analysis results
  },
  "metadata": {
    "processingTime": 1234,                    // Processing time in milliseconds
    "timestamp": "2024-01-01T12:00:00.000Z",   // Analysis timestamp
    "version": "2.0.0"                         // API version
  }
}
```

#### Error Response (400/401/404/429/500)

```json
{
  "success": false,
  "error": "Validation failed",                // Error message
  "details": [                                 // Additional error details (optional)
    {
      "field": "pullRequestNumber",
      "message": "PR number must be a positive integer."
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"      // Error timestamp
}
```

### 2. Service Status

**GET** `/api/analyze/status`

Check service health and status.

#### Response (200/503)

```json
{
  "status": "healthy",                         // "healthy", "degraded", or "unhealthy"
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "2.0.0",
  "uptime": 3600,                             // Server uptime in seconds
  "responseTime": 5,                          // Status check response time in ms
  "services": {
    "service": "healthy",
    "analysis_engine": "healthy",
    "advanced_detection": "healthy"
  },
  "features": {
    "advancedSquashDetection": true,
    "multipleAlgorithms": true,
    "confidenceScoring": true,
    "crossValidation": true,
    "circuitBreaker": true,
    "timeoutProtection": true,
    "analysisDepthControl": true
  },
  "algorithms": {
    "githubApiMergeStrategy": true,
    "timestampPatternAnalysis": true,
    "authorCommitterDiscrepancy": true,
    "commitTreeStructure": true,
    "githubEventsApi": true,
    "diffAnalysis": true,
    "legacyHeuristics": true
  },
  "configuration": {
    "defaultAnalysisDepth": "shallow",
    "supportedDepths": ["shallow", "deep"],
    "defaultAdvancedDetection": true,
    "maxRecursionDepth": 5,
    "timeoutSeconds": 30
  }
}
```

### 3. Configuration Options

**GET** `/api/analyze/config`

Get available configuration options and algorithm details.

#### Response (200)

```json
{
  "version": "2.0.0",
  "analysisDepth": {
    "options": ["shallow", "deep"],
    "default": "shallow",
    "descriptions": {
      "shallow": "Expand only the immediate squash commit (faster)",
      "deep": "Recursively expand all nested squashed PRs (comprehensive)"
    }
  },
  "algorithms": {
    "githubApiMergeStrategy": {
      "name": "GitHub API Merge Strategy Analysis",
      "confidence": 0.95,
      "description": "Uses GitHub PR merge information and API data"
    }
    // ... other algorithms
  },
  "presets": {
    "default": {
      "name": "Default Configuration",
      "description": "Balanced performance and accuracy"
    },
    "performance": {
      "name": "Performance Configuration", 
      "description": "Faster analysis with fewer methods"
    },
    "comprehensive": {
      "name": "Comprehensive Configuration",
      "description": "Maximum accuracy with all methods enabled"
    }
  }
}
```

### 4. API Documentation

**GET** `/api/docs`

Get comprehensive API documentation.

## Usage Examples

### JavaScript/Node.js

```javascript
// Basic analysis
const response = await fetch('http://localhost:9002/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    githubToken: 'ghp_...',
    repoOwner: 'vercel',
    repoName: 'next.js',
    pullRequestNumber: 12345
  })
});

const result = await response.json();
if (result.success) {
  console.log('Analysis completed:', result.data);
} else {
  console.error('Analysis failed:', result.error);
}
```

### cURL

```bash
# Basic analysis
curl -X POST http://localhost:9002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "githubToken": "ghp_...",
    "repoOwner": "vercel",
    "repoName": "next.js", 
    "pullRequestNumber": 12345
  }'

# Deep analysis with advanced detection
curl -X POST http://localhost:9002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "githubToken": "ghp_...",
    "repoOwner": "facebook",
    "repoName": "react",
    "pullRequestNumber": 67890,
    "squashAnalysisDepth": "deep",
    "enableAdvancedDetection": true
  }'

# Check status
curl http://localhost:9002/api/analyze/status

# Get configuration
curl http://localhost:9002/api/analyze/config
```

### Python

```python
import requests

# Basic analysis
response = requests.post('http://localhost:9002/api/analyze', json={
    'githubToken': 'ghp_...',
    'repoOwner': 'vercel',
    'repoName': 'next.js',
    'pullRequestNumber': 12345
})

result = response.json()
if result['success']:
    print('Analysis completed:', result['data'])
else:
    print('Analysis failed:', result['error'])
```

## Authentication

All analysis requests require a GitHub personal access token with repository read access. Include the token in the `githubToken` field of the request body.

### Required Permissions
- Repository read access
- Pull request read access

## Rate Limiting

The API itself has no specific rate limits, but GitHub API limits apply. The service includes:
- Circuit breaker protection
- Automatic retry with exponential backoff
- Graceful degradation on failures

## Error Handling

The API returns appropriate HTTP status codes:

- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid GitHub token)
- **404**: Not Found (repository or PR not found)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

All error responses include:
- `success: false`
- `error`: Human-readable error message
- `details`: Additional error information (development only)
- `timestamp`: Error timestamp

## Advanced Features

### Detection Algorithms (7 Available)

1. **GitHub API Merge Strategy Analysis** (95% confidence)
2. **Commit Timestamp Pattern Analysis** (70% confidence)  
3. **Author vs Committer Discrepancy Detection** (60% confidence)
4. **Commit Tree Structure Analysis** (80% confidence)
5. **GitHub Events API Integration** (95% confidence)
6. **Diff Analysis** (60% confidence)
7. **Legacy Heuristics** (50% confidence)

### Analysis Depth Options

- **Shallow**: Fast analysis, expands only immediate squash commits
- **Deep**: Comprehensive analysis, recursively expands all nested squashed PRs

### Cross-Validation

- Multiple algorithms validate each detection
- Weighted confidence scoring
- Configurable confidence thresholds
- Detailed reasoning for each detection

## Testing

Use the provided example script to test the API:

```bash
node examples/api-usage.js
```

This script demonstrates:
- Status checking
- Configuration retrieval
- Basic and advanced analysis
- Error handling

## Support

- **Documentation**: Available at `/api/docs`
- **Status**: Available at `/api/analyze/status`
- **Configuration**: Available at `/api/analyze/config`
- **Web Interface**: Available at the root URL for interactive testing
