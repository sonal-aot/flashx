import React, { useState } from 'react';
import { Copy, Check, GitBranch, RefreshCw, Lightbulb, Edit3 } from 'lucide-react';
import { BranchGenerationResult } from '../types/ai';
import { copyToClipboard } from '../utils/clipboard';

interface BranchResultCardProps {
  result: BranchGenerationResult;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export const BranchResultCard: React.FC<BranchResultCardProps> = ({
  result,
  onRegenerate,
  isRegenerating,
}) => {
  const [copiedBranch, setCopiedBranch] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBranch, setEditedBranch] = useState(result.recommended);

  // Update editedBranch when result changes
  React.useEffect(() => {
    setEditedBranch(result.recommended);
    setIsEditing(false);
  }, [result.recommended]);

  const handleCopy = async (text: string) => {
    const res = await copyToClipboard(text);
    if (res.success) {
      setCopiedBranch(text);
      setTimeout(() => setCopiedBranch(null), 2000);
    }
  };

  const renderBranchWithStyledPrefix = (branch: string) => {
    const slashIdx = branch.indexOf('/');
    if (slashIdx !== -1) {
      const prefix = branch.substring(0, slashIdx + 1);
      const name = branch.substring(slashIdx + 1);
      return (
        <span className="font-mono text-xs break-all">
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{prefix}</span>
          <span className="text-slate-800 dark:text-slate-200">{name}</span>
        </span>
      );
    }
    return <span className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all">{branch}</span>;
  };

  return (
    <div className="space-y-3">
      {/* Primary Recommended Branch */}
      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-sm relative">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
              Recommended Branch
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
              title={isEditing ? 'Done editing' : 'Quick edit branch name'}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition disabled:opacity-50"
              title="Regenerate with AI"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Branch Display / Inline Edit */}
        {isEditing ? (
          <input
            type="text"
            value={editedBranch}
            onChange={(e) => setEditedBranch(e.target.value)}
            className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
            autoFocus
          />
        ) : (
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between group mb-2">
            <div className="flex items-center space-x-2 overflow-hidden mr-2">
              <GitBranch className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              {renderBranchWithStyledPrefix(editedBranch)}
            </div>
            <button
              onClick={() => handleCopy(editedBranch)}
              className="shrink-0 p-1.5 rounded-md bg-slate-100 hover:bg-indigo-500 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 text-slate-600 dark:text-slate-300 transition-all flex items-center space-x-1"
              title="Copy branch name"
            >
              {copiedBranch === editedBranch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Reason / Context */}
        {result.reason && (
          <div className="flex items-start space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
            <span>{result.reason}</span>
          </div>
        )}
      </div>

      {/* Alternative Suggestions */}
      {result.alternatives && result.alternatives.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-1">
            Alternatives
          </span>
          {result.alternatives.map((alt, index) => (
            <div
              key={index}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="flex items-center space-x-2 mr-2 overflow-hidden">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">#{index + 1}</span>
                {renderBranchWithStyledPrefix(alt)}
              </div>
              <button
                onClick={() => handleCopy(alt)}
                className="shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                title="Copy alternative"
              >
                {copiedBranch === alt ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
