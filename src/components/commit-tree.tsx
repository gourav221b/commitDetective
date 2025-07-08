
'use client';

import * as React from 'react';
import type { AnalyzeCommitLineageOutput, CommitNode as CommitNodeData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitCommit, GitBranch, GitMerge, Zap, ArrowDown, User, Calendar, RotateCcw, Shuffle, GitPullRequest } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// A map to store nodes by SHA for easy lookup
type NodeMap = Map<string, CommitNodeData & { children: CommitNodeData[] }>;

function buildTree(nodes: CommitNodeData[]): (CommitNodeData & { children: CommitNodeData[] })[] {
  if (!nodes || nodes.length === 0) return [];

  const nodeMap: NodeMap = new Map();
  const allNodeShas = new Set(nodes.map(n => n.sha));

  // Initialize map and add children array
  nodes.forEach(node => {
    nodeMap.set(node.sha, { ...node, children: [] });
  });

  const rootNodes: (CommitNodeData & { children: CommitNodeData[] })[] = [];

  // Populate children arrays and identify root nodes
  nodes.forEach(node => {
    const currentNode = nodeMap.get(node.sha)!;
    if (node.parents.length === 0 || node.parents.every(p => !allNodeShas.has(p))) {
      rootNodes.push(currentNode);
    } else {
      node.parents.forEach(parentSha => {
        if (nodeMap.has(parentSha)) {
          const parentNode = nodeMap.get(parentSha);
          // Avoid duplicates
          if (!parentNode?.children.some(c => c.sha === currentNode.sha)) {
            parentNode?.children.push(currentNode);
          }
        } else {
          // Parent is not in our collection, so this node could be a root
          if (!rootNodes.some(r => r.sha === currentNode.sha)) {
            rootNodes.push(currentNode);
          }
        }
      });
    }
  });

  // A simple sort to get a somewhat consistent order. Not perfect for complex graphs.
  const getCommitDate = (sha: string) => new Date(nodeMap.get(sha)?.date || 0).getTime();

  const sortChildrenRecursive = (node: CommitNodeData & { children: CommitNodeData[] }) => {
    node.children.sort((a, b) => getCommitDate(a.sha) - getCommitDate(b.sha));
    node.children.forEach(sortChildrenRecursive as any);
  }

  rootNodes.sort((a, b) => getCommitDate(a.sha) - getCommitDate(b.sha));
  rootNodes.forEach(sortChildrenRecursive as any);

  // Remove duplicates from rootNodes that might have been added as children of external parents
  const finalRootNodes = rootNodes.filter(node =>
    !Array.from(nodeMap.values()).some(parent => parent.children.some(child => child.sha === node.sha))
  );

  return finalRootNodes;
}

const getEventType = (node: CommitNodeData) => {
  if (node.type) return node.type;
  if (node.parents.length > 1) return 'Merge Commit';
  if (node.message.toLowerCase().startsWith('squash!')) return 'Squash';
  return 'Commit';
}

const EventIcon = ({ type, className }: { type: string, className?: string }) => {
  const defaultClass = "h-5 w-5";
  const typeLower = type.toLowerCase();

  if (typeLower.includes('merge')) return <GitMerge className={`${defaultClass} text-purple-500 ${className}`} />;
  if (typeLower.includes('advanced squash')) return <ArrowDown className={`${defaultClass} text-orange-500 ${className}`} />;
  if (typeLower.includes('squash')) return <ArrowDown className={`${defaultClass} text-yellow-500 ${className}`} />;
  if (typeLower.includes('interactive rebase')) return <Shuffle className={`${defaultClass} text-blue-600 ${className}`} />;
  if (typeLower.includes('simple rebase')) return <RotateCcw className={`${defaultClass} text-blue-400 ${className}`} />;
  if (typeLower.includes('rebase')) return <GitBranch className={`${defaultClass} text-blue-500 ${className}`} />;
  if (typeLower.includes('fast-forward')) return <GitPullRequest className={`${defaultClass} text-green-500 ${className}`} />;
  if (typeLower.includes('force push')) return <Zap className={`${defaultClass} text-red-500 ${className}`} />;

  return <GitCommit className={`${defaultClass} text-primary ${className}`} />;
};

function CommitNodeComponent({ node }: { node: (CommitNodeData & { children?: CommitNodeData[] }) }) {
  const eventType = getEventType(node);

  return (
    <li className="relative list-none">
      {/* Connecting lines */}
      <div className="absolute left-4 top-5 h-full border-l-2 border-border"></div>
      <div className="absolute left-4 top-5 w-4 border-t-2 border-border"></div>

      <div className="relative flex items-start gap-4 pl-12">
        <div className="absolute left-0 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card ring-4 ring-card">
          <Tooltip>
            <TooltipTrigger asChild>
              <button><EventIcon type={eventType} /></button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{eventType}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="font-code text-sm font-semibold text-primary truncate" title={node.message}>
            {node.message.split('\n')[0]}
          </p>
          <div className="text-xs text-muted-foreground font-code mt-1">
            SHA: {node.shortSha}
            {node.branch && <Badge variant="secondary" className="ml-2 py-0.5 px-1.5">{node.branch}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><User size={12} /> {node.author}</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(node.date).toLocaleString()}</span>
          </div>
          {node.metadata && (
            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              {node.metadata.originalCommitCount && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="py-0 px-1 text-xs">
                    {node.metadata.originalCommitCount} commits squashed
                  </Badge>
                </div>
              )}
              {node.metadata.expandedCommitsCount && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="py-0 px-1 text-xs text-orange-600">
                    {node.metadata.expandedCommitsCount} commits expanded
                  </Badge>
                </div>
              )}
              {node.metadata.analysisDepth && (
                <Badge variant="outline" className="py-0 px-1 text-xs text-purple-600">
                  {node.metadata.analysisDepth} analysis
                </Badge>
              )}
              {node.metadata.detectionMethods && node.metadata.detectionMethods.length > 0 && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="py-0 px-1 text-xs text-green-600">
                    {node.metadata.detectionMethods.length} detection methods
                  </Badge>
                </div>
              )}
              {node.metadata.forcePushCount && (
                <div className="flex items-center gap-1">
                  <Badge variant="destructive" className="py-0 px-1 text-xs">
                    {node.metadata.forcePushCount} force push{node.metadata.forcePushCount > 1 ? 'es' : ''}
                  </Badge>
                </div>
              )}
              {node.metadata.modifiedHistory && (
                <Badge variant="outline" className="py-0 px-1 text-xs text-blue-600">
                  History Modified
                </Badge>
              )}
              {node.metadata.confidence && (
                <Badge variant="outline" className="py-0 px-1 text-xs">
                  {Math.round(node.metadata.confidence * 100)}% confidence
                </Badge>
              )}
              {node.metadata.reasoning && (
                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/30 rounded border-l-2 border-orange-200">
                  <strong>Detection Reasoning:</strong> {node.metadata.reasoning}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {node.children && node.children.length > 0 && (
        <ul className="mt-4">
          {node.children.map((child) => (
            <CommitNodeComponent key={child.sha} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommitTree({ data }: { data: AnalyzeCommitLineageOutput }) {
  const [tree, setTree] = React.useState<(CommitNodeData & { children: CommitNodeData[] })[]>([]);

  React.useEffect(() => {
    if (data && data.nodes) {
      setTree(buildTree(data.nodes));
    }
  }, [data]);

  if (!data || !data.nodes) {
    return null;
  }

  return (
    <Card className="shadow-md hover:shadow-xl transition-shadow">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <GitBranch /> Commit Lineage Trace
        </CardTitle>
        <CardDescription>
          A deterministic, code-based analysis of the commit history, visualized as a tree.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-1">Analysis Summary</h4>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>
          <TooltipProvider>
            <ul className="space-y-4">
              {tree.map(node => (
                <CommitNodeComponent key={node.sha} node={node} />
              ))}
              {tree.length === 0 && <p className="text-muted-foreground text-center">No commit tree could be generated.</p>}
            </ul>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
