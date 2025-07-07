'use client';

import type { AnalysisResult } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CommitList } from '@/components/commit-list';
import { Clock, GitPullRequestArrow, Milestone } from 'lucide-react';

export function ResultsSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-md hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Clock className="text-accent" />
              Lead Time for Changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-4xl font-bold text-primary">{result.ltc.leadTimeForChanges}</p>
            <p className="text-muted-foreground flex items-center gap-2">
              <Milestone size={16} />
              <span className="font-medium">Code Complete Commit:</span>
            </p>
            <p className="font-code text-sm bg-muted p-2 rounded-md truncate">{result.ltc.codeCompleteCommit}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <GitPullRequestArrow className="text-accent" />
              Commit History Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{result.githubData.analysis}</p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-md hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle className="font-headline">Commit Lineage Trace</CardTitle>
          <CardDescription>
            AI-generated analysis of the commit history, accounting for squashes, rebases, and force pushes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="font-code text-sm bg-muted p-4 rounded-md overflow-x-auto">
            {result.commitLineage.commitLineage}
          </pre>
        </CardContent>
      </Card>

      <CommitList commits={result.githubData.commits} />
    </div>
  );
}
