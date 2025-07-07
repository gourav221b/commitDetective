import type { GitHubCommit } from '@/ai/flows/extract-github-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCommit, User, Calendar, GitBranch } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function CommitList({ commits }: { commits: GitHubCommit[] }) {
  return (
    <Card className="shadow-md hover:shadow-xl transition-shadow">
      <CardHeader>
        <CardTitle className="font-headline">Commit Details</CardTitle>
        <CardDescription>A detailed list of all commits associated with this pull request.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {commits.map((commit, index) => (
            <li key={commit.sha} className="border p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <GitCommit className="text-primary hidden sm:block" />
                  <div className="min-w-0">
                    <p className="font-code text-sm font-semibold text-primary truncate" title={commit.commit.message}>
                      {commit.commit.message.split('\n')[0]}
                    </p>
                    <p className="font-code text-xs text-muted-foreground">
                      SHA: {commit.sha.substring(0, 7)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <Badge variant="outline" className="flex items-center gap-1.5">
                    <User size={14} />
                    {commit.commit.author?.name || 'N/A'}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {format(parseISO(commit.commit.author.date), "MMM d, yyyy 'at' hh:mm a")}
                  </Badge>
                </div>
              </div>
              {commit.parents.length > 1 && (
                <div className="mt-2 pl-8 flex items-center gap-2 text-xs text-accent">
                  <GitBranch size={14} />
                  <span>Merge commit</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
