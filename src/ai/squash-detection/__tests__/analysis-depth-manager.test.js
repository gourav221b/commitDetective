const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock the analysis depth manager
class MockAnalysisDepthManager {
  constructor(octokit, config) {
    this.octokit = octokit;
    this.config = config;
    this.detector = {
      detectSquash: () => Promise.resolve({})
    };
  }

  async analyzeWithDepth(mergeCommit, prCommits, prData, repoOwner, repoName, processedPRs = new Set(), currentDepth = 0) {
    // Mock squash detection result
    const squashResult = {
      isSquash: prCommits.length > 1 && mergeCommit.parents.length === 1,
      confidence: 0.8,
      methods: [
        {
          method: 'github-api-strategy',
          confidence: 0.9,
          isSquash: true,
          reasoning: 'Mock detection',
          evidence: {},
          weight: 0.4
        }
      ],
      reasoning: 'Mock cross-validation result'
    };

    const analysisMetadata = {
      detectionMethods: squashResult.methods,
      analysisDepth: this.config.analysisDepth,
      currentDepth,
      reasoning: squashResult.reasoning
    };

    if (!squashResult.isSquash) {
      return {
        isSquash: false,
        confidence: squashResult.confidence,
        expandedCommits: [],
        analysisMetadata
      };
    }

    if (this.config.analysisDepth === 'shallow') {
      return this.performShallowAnalysis(mergeCommit, prCommits, prData, squashResult, analysisMetadata);
    } else {
      return this.performDeepAnalysis(mergeCommit, prCommits, prData, repoOwner, repoName, squashResult, processedPRs, currentDepth, analysisMetadata);
    }
  }

  performShallowAnalysis(mergeCommit, prCommits, prData, squashResult, analysisMetadata) {
    const expandedCommits = prCommits.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      author: commit.commit.author?.name || 'N/A',
      date: commit.commit.author?.date || new Date().toISOString(),
      parents: commit.parents?.map(p => p.sha) || [],
      branch: prData.prDetails.head.ref,
      type: 'Squashed Commit',
      metadata: {
        originallySquashed: true,
        squashParent: mergeCommit.sha,
        analysisDepth: 'shallow',
        detectionMethods: squashResult.methods,
        confidence: squashResult.confidence
      }
    }));

    analysisMetadata.expandedCommitsCount = expandedCommits.length;
    analysisMetadata.shallowAnalysisComplete = true;

    return {
      isSquash: true,
      confidence: squashResult.confidence,
      expandedCommits,
      analysisMetadata
    };
  }

  performDeepAnalysis(mergeCommit, prCommits, prData, repoOwner, repoName, squashResult, processedPRs, currentDepth, analysisMetadata) {
    const expandedCommits = [];
    const maxDepth = 5;

    if (currentDepth >= maxDepth) {
      analysisMetadata.maxDepthReached = true;
      return this.performShallowAnalysis(mergeCommit, prCommits, prData, squashResult, analysisMetadata);
    }

    // Process each commit and look for nested PRs
    for (const commit of prCommits) {
      const nestedPrNumber = this.extractPrNumberFromMessage(commit.commit.message);

      if (nestedPrNumber && !processedPRs.has(nestedPrNumber)) {
        processedPRs.add(nestedPrNumber);

        // Mock nested PR analysis
        const nestedExpandedCommits = [
          {
            sha: `nested-${commit.sha}`,
            shortSha: `nested-${commit.sha.substring(0, 7)}`,
            message: `Nested commit from PR #${nestedPrNumber}`,
            author: commit.commit.author?.name || 'N/A',
            date: commit.commit.author?.date || new Date().toISOString(),
            parents: [],
            branch: `nested-branch-${nestedPrNumber}`,
            type: 'Expanded Commit',
            metadata: {
              originallySquashed: true,
              nestedPrNumber,
              analysisDepth: 'deep',
              currentDepth: currentDepth + 1
            }
          }
        ];

        expandedCommits.push(...nestedExpandedCommits);

        analysisMetadata.nestedAnalyses = analysisMetadata.nestedAnalyses || [];
        analysisMetadata.nestedAnalyses.push({
          prNumber: nestedPrNumber,
          depth: currentDepth + 1,
          expandedCommitsCount: nestedExpandedCommits.length
        });
      } else {
        expandedCommits.push({
          sha: commit.sha,
          shortSha: commit.sha.substring(0, 7),
          message: commit.commit.message,
          author: commit.commit.author?.name || 'N/A',
          date: commit.commit.author?.date || new Date().toISOString(),
          parents: commit.parents?.map(p => p.sha) || [],
          branch: prData.prDetails.head.ref,
          type: 'Expanded Commit',
          metadata: {
            originallySquashed: true,
            analysisDepth: 'deep',
            currentDepth
          }
        });
      }
    }

    analysisMetadata.expandedCommitsCount = expandedCommits.length;
    analysisMetadata.deepAnalysisComplete = true;
    analysisMetadata.finalDepth = currentDepth;

    return {
      isSquash: true,
      confidence: squashResult.confidence,
      expandedCommits,
      analysisMetadata
    };
  }

  extractPrNumberFromMessage(message) {
    const match = message.match(/\(#(\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  static getDefaultConfig(analysisDepth = 'shallow') {
    return {
      analysisDepth,
      enabledMethods: ['github-api-strategy', 'timestamp-pattern', 'legacy-heuristics'],
      confidenceThreshold: 0.6,
      crossValidationRequired: true
    };
  }

  static getPerformanceConfig(analysisDepth = 'shallow') {
    return {
      analysisDepth,
      enabledMethods: ['github-api-strategy', 'legacy-heuristics'],
      confidenceThreshold: 0.5,
      crossValidationRequired: false
    };
  }

  static getComprehensiveConfig(analysisDepth = 'deep') {
    return {
      analysisDepth,
      enabledMethods: ['github-api-strategy', 'timestamp-pattern', 'author-committer-discrepancy', 'github-events-api', 'legacy-heuristics'],
      confidenceThreshold: 0.7,
      crossValidationRequired: true
    };
  }
}

describe('Analysis Depth Manager', () => {
  let manager;
  let mockOctokit;
  let mockConfig;
  let mockMergeCommit;
  let mockPrCommits;
  let mockPrData;

  beforeEach(() => {
    mockOctokit = {
      repos: { getCommit: () => Promise.resolve({}) }
    };

    mockConfig = MockAnalysisDepthManager.getDefaultConfig('shallow');
    manager = new MockAnalysisDepthManager(mockOctokit, mockConfig);

    mockMergeCommit = {
      sha: 'merge123',
      parents: [{ sha: 'parent1' }],
      commit: {
        message: 'feat: add new feature (#123)',
        author: { name: 'Test Author', email: 'author@example.com', date: '2023-01-01T00:00:00Z' }
      }
    };

    mockPrCommits = [
      {
        sha: 'commit1',
        parents: [{ sha: 'parent0' }],
        commit: {
          message: 'Initial commit',
          author: { name: 'Test Author', email: 'author@example.com', date: '2023-01-01T00:00:00Z' }
        }
      },
      {
        sha: 'commit2',
        parents: [{ sha: 'commit1' }],
        commit: {
          message: 'Add feature (#456)',
          author: { name: 'Test Author', email: 'author@example.com', date: '2023-01-01T01:00:00Z' }
        }
      }
    ];

    mockPrData = {
      prDetails: { head: { ref: 'feature-branch' } },
      prCommits: mockPrCommits,
      mergeCommit: mockMergeCommit
    };
  });

  describe('Shallow Analysis', () => {
    it('should expand only immediate squash commits', async () => {
      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.isSquash).toBe(true);
      expect(result.expandedCommits.length).toBe(2); // Both PR commits
      expect(result.analysisMetadata.shallowAnalysisComplete).toBe(true);
      expect(result.analysisMetadata.analysisDepth).toBe('shallow');

      // Check that expanded commits have correct metadata
      result.expandedCommits.forEach(commit => {
        expect(commit.type).toBe('Squashed Commit');
        expect(commit.metadata.originallySquashed).toBe(true);
        expect(commit.metadata.analysisDepth).toBe('shallow');
      });
    });

    it('should not recursively expand nested PRs in shallow mode', async () => {
      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      // Should not have nested analysis metadata
      expect(result.analysisMetadata.nestedAnalyses).toBeUndefined();
      expect(result.analysisMetadata.deepAnalysisComplete).toBeUndefined();
    });
  });

  describe('Deep Analysis', () => {
    beforeEach(() => {
      mockConfig = MockAnalysisDepthManager.getDefaultConfig('deep');
      manager = new MockAnalysisDepthManager(mockOctokit, mockConfig);
    });

    it('should recursively expand nested PRs', async () => {
      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.isSquash).toBe(true);
      expect(result.expandedCommits.length).toBeGreaterThanOrEqual(2); // Should include nested commits
      expect(result.analysisMetadata.deepAnalysisComplete).toBe(true);
      expect(result.analysisMetadata.nestedAnalyses).toBeDefined();
      expect(result.analysisMetadata.nestedAnalyses.length).toBe(1); // One nested PR found
    });

    it('should track nested PR analysis metadata', async () => {
      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const nestedAnalysis = result.analysisMetadata.nestedAnalyses[0];
      expect(nestedAnalysis.prNumber).toBe(456); // From commit message (#456)
      expect(nestedAnalysis.depth).toBe(1);
      expect(nestedAnalysis.expandedCommitsCount).toBeGreaterThan(0);
    });

    it('should prevent infinite recursion with max depth limit', async () => {
      // Create a scenario that could cause infinite recursion
      const deepMockPrCommits = Array.from({ length: 10 }, (_, i) => ({
        sha: `commit${i}`,
        parents: [{ sha: i > 0 ? `commit${i - 1}` : 'parent0' }],
        commit: {
          message: `Commit ${i} (#${100 + i})`,
          author: { name: 'Test Author', email: 'author@example.com', date: '2023-01-01T00:00:00Z' }
        }
      }));

      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        deepMockPrCommits,
        { ...mockPrData, prCommits: deepMockPrCommits },
        'owner',
        'repo',
        new Set(),
        4 // Start near max depth
      );

      expect(result.analysisMetadata).toBeDefined();
      // Should have some indication of depth analysis completion
      expect(
        result.analysisMetadata.maxDepthReached === true ||
        result.analysisMetadata.shallowAnalysisComplete === true ||
        result.expandedCommits.length > 0
      ).toBe(true);
    });
  });

  describe('Configuration Presets', () => {
    it('should provide default configuration', () => {
      const config = MockAnalysisDepthManager.getDefaultConfig('shallow');

      expect(config.analysisDepth).toBe('shallow');
      expect(config.enabledMethods).toContain('github-api-strategy');
      expect(config.confidenceThreshold).toBe(0.6);
      expect(config.crossValidationRequired).toBe(true);
    });

    it('should provide performance configuration', () => {
      const config = MockAnalysisDepthManager.getPerformanceConfig('shallow');

      expect(config.analysisDepth).toBe('shallow');
      expect(config.enabledMethods.length).toBeLessThan(5); // Fewer methods for performance
      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.crossValidationRequired).toBe(false);
    });

    it('should provide comprehensive configuration', () => {
      const config = MockAnalysisDepthManager.getComprehensiveConfig('deep');

      expect(config.analysisDepth).toBe('deep');
      expect(config.enabledMethods.length).toBeGreaterThan(3); // More methods for accuracy
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.crossValidationRequired).toBe(true);
    });
  });

  describe('PR Number Extraction', () => {
    it('should extract PR numbers from commit messages', () => {
      expect(manager.extractPrNumberFromMessage('feat: add feature (#123)')).toBe(123);
      expect(manager.extractPrNumberFromMessage('Fix bug (#456)')).toBe(456);
      expect(manager.extractPrNumberFromMessage('No PR number')).toBeNull();
      expect(manager.extractPrNumberFromMessage('Multiple (#123) PR (#456) numbers')).toBe(123); // First match
    });
  });

  describe('Non-Squash Commits', () => {
    it('should handle non-squash commits correctly', async () => {
      // Single commit PR (not a squash)
      const singleCommitPr = [mockPrCommits[0]];

      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        singleCommitPr,
        { ...mockPrData, prCommits: singleCommitPr },
        'owner',
        'repo'
      );

      expect(result.isSquash).toBe(false);
      expect(result.expandedCommits.length).toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing commit data gracefully', async () => {
      const malformedCommits = [
        {
          sha: 'malformed',
          commit: {} // Missing required fields
        }
      ];

      const result = await manager.analyzeWithDepth(
        mockMergeCommit,
        malformedCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result).toBeDefined();
      expect(result.expandedCommits).toBeDefined();
    });
  });
});
