import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bug, Bookmark, CheckSquare, Layers } from 'lucide-react';
import { JiraIssue } from '../types/jira';

interface JiraCardProps {
  issue: JiraIssue | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

export const JiraCard: React.FC<JiraCardProps> = ({ issue, isLoading, onRefresh }) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const getTypeBadgeStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('bug')) {
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900',
        icon: <Bug className="w-3 h-3 mr-1" />,
      };
    }
    if (t.includes('story')) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
        icon: <Bookmark className="w-3 h-3 mr-1" />,
      };
    }
    if (t.includes('epic')) {
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900',
        icon: <Layers className="w-3 h-3 mr-1" />,
      };
    }
    return {
      bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900',
      icon: <CheckSquare className="w-3 h-3 mr-1" />,
    };
  };

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/60 rounded"></div>
        <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2.5">
          <AlertCircle className="w-5 h-5 text-slate-500" />
        </div>
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
          No Jira Ticket Detected
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-3">
          Open an issue in Jira Cloud (e.g. <span className="font-mono text-[10px] text-indigo-500">*.atlassian.net/browse/PROJ-123</span>) to automatically detect it.
        </p>
        <div className="flex items-center justify-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Re-scan Tab
            </button>
          )}
        </div>
      </div>
    );
  }

  const badge = getTypeBadgeStyle(issue.issueType);

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm relative overflow-hidden group">
      {/* Top row: Key + Type + Link */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
            {issue.key}
          </span>
          <span
            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}
          >
            {badge.icon}
            {issue.issueType}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
              title="Refresh ticket data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {issue.url && (
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
              title="Open ticket in Jira"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Ticket Title */}
      <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 mb-2">
        {issue.title}
      </h2>

      {/* Description preview */}
      {issue.description ? (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          <p className={`${isDescExpanded ? '' : 'line-clamp-2'} leading-relaxed`}>
            {issue.description}
          </p>
          {issue.description.length > 80 && (
            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="inline-flex items-center text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 hover:underline font-medium"
            >
              {isDescExpanded ? (
                <>
                  Show less <ChevronUp className="w-3 h-3 ml-0.5" />
                </>
              ) : (
                <>
                  Show full description <ChevronDown className="w-3 h-3 ml-0.5" />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="pt-1.5 text-[10px] text-slate-400 italic">
          No description in Jira ticket
        </div>
      )}
    </div>
  );
};
