import React, { useState } from 'react';
import { ExternalLink, ChevronDown, RefreshCw, Bug, Bookmark, CheckSquare, Layers } from 'lucide-react';
import { JiraIssue } from '../types/jira';

interface JiraCardProps {
  issue: JiraIssue | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

const typeIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('bug')) return Bug;
  if (t.includes('story')) return Bookmark;
  if (t.includes('epic')) return Layers;
  return CheckSquare;
};

export const JiraCard: React.FC<JiraCardProps> = ({ issue, isLoading, onRefresh }) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  if (isLoading) {
    // Same footprint as the loaded ticket + Generate button, so nothing shifts on load.
    return (
      <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading ticket">
        <div>
          <div className="h-3.5 w-28 rounded bg-raised" />
          <div className="mt-3 h-4 w-11/12 rounded bg-raised" />
          <div className="mt-2 h-4 w-3/5 rounded bg-raised" />
          <div className="mt-3.5 h-3 w-24 rounded bg-raised" />
        </div>
        <div className="space-y-3">
          <div className="h-10 rounded-md bg-raised" />
          <div className="h-7 w-48 rounded-md bg-raised" />
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <section className="py-6 text-center animate-enter">
        <h2 className="text-sm font-semibold">No Jira ticket detected</h2>
        <p className="mt-1.5 text-xs text-muted leading-relaxed max-w-[280px] mx-auto">
          Open an issue in Jira Cloud, such as{' '}
          <span className="font-mono text-[11px] text-fg">*.atlassian.net/browse/PROJ-123</span>, then scan again.
        </p>
        {onRefresh && (
          <button onClick={onRefresh} className="btn btn-secondary mt-4">
            <RefreshCw className="w-3.5 h-3.5" />
            Scan tab again
          </button>
        )}
      </section>
    );
  }

  const TypeIcon = typeIcon(issue.issueType);

  return (
    <section className="animate-enter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-accent-text">{issue.key}</span>
          <span className="text-line-strong">·</span>
          <span className="inline-flex items-center gap-1 text-muted">
            <TypeIcon className="w-3.5 h-3.5" />
            {issue.issueType}
          </span>
        </div>
        <div className="flex items-center -mr-1.5">
          {onRefresh && (
            <button onClick={onRefresh} className="icon-btn" title="Refresh ticket" aria-label="Refresh ticket">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {issue.url && (
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              title="Open in Jira"
              aria-label="Open in Jira"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <h2 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight line-clamp-3">{issue.title}</h2>

      {issue.description && (
        <div className="mt-2">
          {isDescExpanded && (
            <p className="mb-1.5 text-xs text-muted leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">
              {issue.description}
            </p>
          )}
          <button
            onClick={() => setIsDescExpanded(!isDescExpanded)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-subtle hover:text-fg transition-colors"
            aria-expanded={isDescExpanded}
          >
            {isDescExpanded ? 'Hide description' : 'Show description'}
            <ChevronDown className={`w-3 h-3 transition-transform ${isDescExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </section>
  );
};
