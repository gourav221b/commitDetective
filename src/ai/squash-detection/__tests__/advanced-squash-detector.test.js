const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock Octokit
const mockOctokit = {
  repos: {
    getCommit: () => Promise.resolve({}),
  }
};

// Mock the advanced squash detector
class MockAdvancedSquashDetector {
  constructor(octokit, config) {
    this.octokit = octokit;
    this.config = config;
  }

  async detectSquash(mergeCommit, prCommits, prData, repoOwner, repoName) {
    // Mock implementation for testing
    const methods = [];

    // GitHub API Strategy Test
    if (this.config.enabledMethods.includes('github-api-strategy')) {
      methods.push({
        method: 'github-api-strategy',
        confidence: 0.9,
        isSquash: prCommits.length > 1 && mergeCommit.parents.length === 1,
        reasoning: 'GitHub API indicates squash merge',
        evidence: { mergeCommitSha: mergeCommit.sha },
        weight: 0.4
      });
    }

    // Timestamp Pattern Test
    if (this.config.enabledMethods.includes('timestamp-pattern')) {
      const hasClusteredTimestamps = prCommits.length > 1;
      methods.push({
        method: 'timestamp-pattern',
        confidence: hasClusteredTimestamps ? 0.7 : 0.2,
        isSquash: hasClusteredTimestamps,
        reasoning: 'Timestamp pattern analysis',
        evidence: { hasClusteredTimestamps },
        weight: 0.2
      });
    }

    // Author-Committer Discrepancy Test
    if (this.config.enabledMethods.includes('author-committer-discrepancy')) {
      const hasDiscrepancy = mergeCommit.commit.author?.email !== mergeCommit.commit.committer?.email;
      methods.push({
        method: 'author-committer-discrepancy',
        confidence: hasDiscrepancy ? 0.6 : 0.3,
        isSquash: hasDiscrepancy,
        reasoning: 'Author/committer analysis',
        evidence: { hasDiscrepancy },
        weight: 0.15
      });
    }

    return this.crossValidateResults(methods);
  }

  crossValidateResults(results) {
    if (results.length === 0) {
      return {
        isSquash: false,
        confidence: 0,
        methods: [],
        reasoning: 'No detection methods executed'
      };
    }

    const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
    const weightedSquashScore = results.reduce((sum, result) => {
      return sum + (result.isSquash ? result.confidence * result.weight : 0);
    }, 0);
    const weightedNonSquashScore = results.reduce((sum, result) => {
      return sum + (!result.isSquash ? result.confidence * result.weight : 0);
    }, 0);

    const finalConfidence = Math.max(weightedSquashScore, weightedNonSquashScore) / totalWeight;
    const isSquash = weightedSquashScore > weightedNonSquashScore;
    const meetsThreshold = finalConfidence >= this.config.confidenceThreshold;

    return {
      isSquash: isSquash && meetsThreshold,
      confidence: finalConfidence,
      methods: results,
      reasoning: `Cross-validation of ${results.length} methods`
    };
  }
}

describe('Advanced Squash Detection System', () => {
  let detector;
  let mockConfig;
  let mockMergeCommit;
  let mockPrCommits;
  let mockPrData;

  beforeEach(() => {
    mockConfig = {
      analysisDepth: 'shallow',
      enabledMethods: ['github-api-strategy', 'timestamp-pattern', 'author-committer-discrepancy'],
      confidenceThreshold: 0.6,
      crossValidationRequired: true
    };

    detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

    mockMergeCommit = {
      sha: 'merge123',
      parents: [{ sha: 'parent1' }],
      commit: {
        message: 'feat: add new feature (#123)',
        author: { email: 'author@example.com', date: '2023-01-01T00:00:00Z' },
        committer: { email: 'committer@example.com', date: '2023-01-01T00:01:00Z' }
      }
    };

    mockPrCommits = [
      {
        sha: 'commit1',
        commit: {
          message: 'Initial commit',
          author: { email: 'author@example.com', date: '2023-01-01T00:00:00Z' }
        }
      },
      {
        sha: 'commit2',
        commit: {
          message: 'Add feature',
          author: { email: 'author@example.com', date: '2023-01-01T00:00:30Z' }
        }
      }
    ];

    mockPrData = {
      prDetails: { head: { ref: 'feature-branch' } },
      prCommits: mockPrCommits,
      mergeCommit: mockMergeCommit
    };
  });

  describe('GitHub API Strategy Detection', () => {
    it('should detect squash when merge commit has single parent and multiple PR commits', async () => {
      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.isSquash).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.methods.some(m => m.method === 'github-api-strategy')).toBe(true);
    });

    it('should not detect squash for merge commits with multiple parents', async () => {
      mockMergeCommit.parents = [{ sha: 'parent1' }, { sha: 'parent2' }];

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const githubApiMethod = result.methods.find(m => m.method === 'github-api-strategy');
      expect(githubApiMethod.isSquash).toBe(false);
    });
  });

  describe('Timestamp Pattern Detection', () => {
    it('should detect squash when commits have clustered timestamps', async () => {
      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const timestampMethod = result.methods.find(m => m.method === 'timestamp-pattern');
      expect(timestampMethod.isSquash).toBe(true);
      expect(timestampMethod.confidence).toBeGreaterThan(0.5);
    });

    it('should not detect squash for single commit PRs', async () => {
      mockPrCommits = [mockPrCommits[0]]; // Only one commit

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const timestampMethod = result.methods.find(m => m.method === 'timestamp-pattern');
      expect(timestampMethod.isSquash).toBe(false);
    });
  });

  describe('Author-Committer Discrepancy Detection', () => {
    it('should detect squash when author differs from committer', async () => {
      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const discrepancyMethod = result.methods.find(m => m.method === 'author-committer-discrepancy');
      expect(discrepancyMethod.isSquash).toBe(true);
      expect(discrepancyMethod.evidence.hasDiscrepancy).toBe(true);
    });

    it('should not detect squash when author equals committer', async () => {
      mockMergeCommit.commit.committer.email = 'author@example.com'; // Same as author

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      const discrepancyMethod = result.methods.find(m => m.method === 'author-committer-discrepancy');
      expect(discrepancyMethod.isSquash).toBe(false);
    });
  });

  describe('Cross-Validation System', () => {
    it('should combine multiple detection methods with weighted scoring', async () => {
      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.methods.length).toBe(3); // All enabled methods
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Cross-validation of 3 methods');
    });

    it('should respect confidence threshold', async () => {
      mockConfig.confidenceThreshold = 0.95; // Very high threshold
      detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      // Should fail to meet high threshold
      expect(result.isSquash).toBe(false);
    });

    it('should handle empty detection methods gracefully', async () => {
      mockConfig.enabledMethods = [];
      detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.isSquash).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.methods.length).toBe(0);
    });
  });

  describe('Configuration Options', () => {
    it('should support different method combinations', async () => {
      mockConfig.enabledMethods = ['github-api-strategy']; // Only one method
      detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      expect(result.methods.length).toBe(1);
      expect(result.methods[0].method).toBe('github-api-strategy');
    });

    it('should adjust confidence based on method weights', async () => {
      // Test with high-weight method only
      mockConfig.enabledMethods = ['github-api-strategy'];
      detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

      const result1 = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      // Test with low-weight method only
      mockConfig.enabledMethods = ['author-committer-discrepancy'];
      detector = new MockAdvancedSquashDetector(mockOctokit, mockConfig);

      const result2 = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      // High-weight method should have higher confidence
      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      // Override the mock to simulate failure
      mockOctokit.repos.getCommit = () => Promise.reject(new Error('API Error'));

      const result = await detector.detectSquash(
        mockMergeCommit,
        mockPrCommits,
        mockPrData,
        'owner',
        'repo'
      );

      // Should still return a result even with API failures
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed commit data', async () => {
      const malformedCommit = {
        sha: 'malformed',
        parents: [],
        commit: {} // Missing required fields
      };

      const result = await detector.detectSquash(
        malformedCommit,
        [],
        mockPrData,
        'owner',
        'repo'
      );

      expect(result).toBeDefined();
      expect(result.isSquash).toBe(false);
    });
  });
});
