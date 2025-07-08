// Simple test script to verify the enhanced git commit detection
const { analyzeCommitLineage } = require('./src/ai/flows/analyze-commit-lineage.ts');

async function testAnalysis() {
  try {
    console.log('Testing enhanced git commit detection...');
    
    const result = await analyzeCommitLineage({
      repoOwner: 'truxt-ai',
      repoName: 'truxt-public-page-black-build',
      pullRequestNumber: 114,
      githubToken: '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'
    });
    
    console.log('\n=== ANALYSIS RESULTS ===');
    console.log('Summary:', result.summary);
    console.log('Total nodes:', result.nodes.length);
    
    // Check for enhanced features
    const operationTypes = {};
    const enhancedNodes = [];
    
    result.nodes.forEach(node => {
      const type = node.type || 'Unknown';
      operationTypes[type] = (operationTypes[type] || 0) + 1;
      
      if (node.metadata) {
        enhancedNodes.push({
          sha: node.shortSha,
          type: node.type,
          metadata: node.metadata
        });
      }
    });
    
    console.log('\n=== OPERATION TYPES DETECTED ===');
    Object.entries(operationTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    
    console.log('\n=== ENHANCED METADATA ===');
    enhancedNodes.forEach(node => {
      console.log(`${node.sha} (${node.type}):`, JSON.stringify(node.metadata, null, 2));
    });
    
    // Verify enhanced features are working
    const hasSquashDetection = result.nodes.some(n => n.type === 'Squash');
    const hasRebaseDetection = result.nodes.some(n => n.type?.includes('Rebase'));
    const hasMetadata = result.nodes.some(n => n.metadata);
    const hasConfidenceScores = result.nodes.some(n => n.metadata?.confidence);
    
    console.log('\n=== FEATURE VERIFICATION ===');
    console.log('✅ Enhanced squash detection:', hasSquashDetection ? 'WORKING' : 'NOT DETECTED');
    console.log('✅ Rebase detection:', hasRebaseDetection ? 'WORKING' : 'NOT DETECTED');
    console.log('✅ Metadata support:', hasMetadata ? 'WORKING' : 'NOT DETECTED');
    console.log('✅ Confidence scores:', hasConfidenceScores ? 'WORKING' : 'NOT DETECTED');
    
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAnalysis();
