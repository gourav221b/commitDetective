'use client';

import type { AnalysisResult } from '@/lib/types';
import { CommitTree } from './commit-tree';

export function ResultsSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-8 animate-fade-in">
      {result.commitLineage && result.commitLineage.nodes && (
        <CommitTree data={result.commitLineage} />
      )}
    </div>
  );
}
