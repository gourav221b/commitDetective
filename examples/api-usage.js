#!/usr/bin/env node

/**
 * CommitDetective API Usage Examples
 * 
 * This script demonstrates how to use the CommitDetective REST API
 * to analyze GitHub pull requests for squash commits and commit lineage.
 */

const API_BASE_URL = 'http://localhost:9002/api';

// Example 1: Check API Status
async function checkStatus() {
  console.log('🔍 Checking API Status...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/analyze/status`);
    const data = await response.json();
    
    console.log(`✅ API Status: ${data.status}`);
    console.log(`📊 Version: ${data.version}`);
    console.log(`⏱️  Response Time: ${data.responseTime}ms`);
    console.log(`🔧 Features: ${Object.keys(data.features).length} available`);
    console.log(`🧠 Algorithms: ${Object.keys(data.algorithms).length} detection methods`);
    
    return data.status === 'healthy';
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    return false;
  }
}

// Example 2: Get Configuration Options
async function getConfiguration() {
  console.log('\n📋 Getting Configuration Options...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/analyze/config`);
    const data = await response.json();
    
    console.log(`📊 Version: ${data.version}`);
    console.log(`🔍 Analysis Depths: ${data.analysisDepth.options.join(', ')}`);
    console.log(`🧠 Detection Algorithms: ${Object.keys(data.algorithms).length}`);
    console.log(`⚙️  Configuration Presets: ${Object.keys(data.presets).length}`);
    
    // Show algorithm details
    console.log('\n🧠 Available Detection Algorithms:');
    Object.entries(data.algorithms).forEach(([key, algo]) => {
      console.log(`  • ${algo.name} (${(algo.confidence * 100).toFixed(0)}% confidence)`);
    });
    
    return data;
  } catch (error) {
    console.error('❌ Configuration fetch failed:', error.message);
    return null;
  }
}

// Example 3: Analyze a Pull Request (Basic)
async function analyzeBasic(githubToken, repoOwner, repoName, pullRequestNumber) {
  console.log(`\n🔍 Analyzing PR #${pullRequestNumber} (Basic Analysis)...`);
  
  const requestBody = {
    githubToken,
    repoOwner,
    repoName,
    pullRequestNumber
    // Using defaults: squashAnalysisDepth: "shallow", enableAdvancedDetection: true
  };
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    if (data.success) {
      console.log(`✅ Analysis completed in ${processingTime}ms`);
      console.log(`📊 Server processing time: ${data.metadata.processingTime}ms`);
      console.log(`🔍 Commits analyzed: ${data.data.commits?.length || 0}`);
      console.log(`📈 Analysis result available`);
      
      // Show squash detection results if available
      if (data.data.commits) {
        const squashCommits = data.data.commits.filter(c => c.type?.includes('squash'));
        console.log(`🔄 Squash commits detected: ${squashCommits.length}`);
      }
      
      return data;
    } else {
      console.error(`❌ Analysis failed: ${data.error}`);
      if (data.details) {
        console.error('📋 Details:', data.details);
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return null;
  }
}

// Example 4: Analyze with Advanced Options
async function analyzeAdvanced(githubToken, repoOwner, repoName, pullRequestNumber) {
  console.log(`\n🔍 Analyzing PR #${pullRequestNumber} (Advanced Analysis)...`);
  
  const requestBody = {
    githubToken,
    repoOwner,
    repoName,
    pullRequestNumber,
    squashAnalysisDepth: 'deep',
    enableAdvancedDetection: true
  };
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    if (data.success) {
      console.log(`✅ Advanced analysis completed in ${processingTime}ms`);
      console.log(`📊 Server processing time: ${data.metadata.processingTime}ms`);
      console.log(`🔍 Total commits: ${data.data.commits?.length || 0}`);
      
      // Show enhanced detection results
      if (data.data.commits) {
        const squashCommits = data.data.commits.filter(c => 
          c.type?.includes('squash') || c.metadata?.confidence
        );
        console.log(`🔄 Enhanced squash detection results: ${squashCommits.length} commits`);
        
        // Show confidence scores if available
        squashCommits.forEach((commit, index) => {
          if (commit.metadata?.confidence) {
            console.log(`  • Commit ${index + 1}: ${(commit.metadata.confidence * 100).toFixed(1)}% confidence`);
          }
        });
      }
      
      return data;
    } else {
      console.error(`❌ Advanced analysis failed: ${data.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Advanced request failed:', error.message);
    return null;
  }
}

// Example 5: Error Handling Demo
async function demonstrateErrorHandling() {
  console.log('\n🚨 Demonstrating Error Handling...');
  
  // Test with invalid data
  const invalidRequest = {
    githubToken: 'invalid',
    repoOwner: '',
    repoName: 'test',
    pullRequestNumber: -1
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest),
    });
    
    const data = await response.json();
    
    console.log(`📋 Response Status: ${response.status}`);
    console.log(`❌ Expected Error: ${data.error}`);
    
    if (data.details) {
      console.log('📋 Validation Details:');
      data.details.forEach(detail => {
        console.log(`  • ${detail.field}: ${detail.message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling demo failed:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 CommitDetective API Usage Examples\n');
  
  // Check if API is healthy
  const isHealthy = await checkStatus();
  if (!isHealthy) {
    console.log('❌ API is not healthy. Please check the server.');
    return;
  }
  
  // Get configuration
  await getConfiguration();
  
  // Demonstrate error handling
  await demonstrateErrorHandling();
  
  console.log('\n📚 Usage Examples:');
  console.log('1. Basic Analysis:');
  console.log('   analyzeBasic("your-token", "owner", "repo", 123)');
  console.log('2. Advanced Analysis:');
  console.log('   analyzeAdvanced("your-token", "owner", "repo", 123)');
  
  console.log('\n✅ API Examples completed!');
  console.log('💡 Replace the placeholder values with real GitHub data to test analysis.');
}

// Export functions for use as a module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkStatus,
    getConfiguration,
    analyzeBasic,
    analyzeAdvanced,
    demonstrateErrorHandling
  };
}

// Run examples if called directly
if (require.main === module) {
  main().catch(console.error);
}
