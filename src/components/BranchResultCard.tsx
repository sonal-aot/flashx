import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Pencil, ChevronDown } from 'lucide-react';
import { BranchGenerationResult } from '../types/ai';
import { copyToClipboard } from '../utils/clipboard';

interface BranchResultCardProps {
  result: BranchGenerationResult;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const BranchName: React.FC<{ branch: string }> = ({ branch }) => {
  const slashIdx = branch.indexOf('/');
  if (slashIdx === -1) return <>{branch}</>;
  return (
    <>
      <span className="text-accent-text">{branch.slice(0, slashIdx + 1)}</span>
      {branch.slice(slashIdx + 1)}
    </>
  );
};

export const BranchResultCard: React.FC<BranchResultCardProps> = ({ result, onRegenerate, isRegenerating }) => {
  const [copiedBranch, setCopiedBranch] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBranch, setEditedBranch] = useState(result.recommended);
  const [showAlternatives, setShowAlternatives] = useState(false);

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

  const copied = copiedBranch === editedBranch;
  const alternatives = result.alternatives ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow">Recommended branch</span>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="btn btn-tertiary h-6 text-[11px]"
          aria-pressed={isEditing}
        >
          <Pencil className="w-3 h-3" />
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        <input
          type="text"
          value={editedBranch}
          onChange={(e) => setEditedBranch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          className="input h-auto py-3 font-mono text-[13px]"
          spellCheck={false}
          autoFocus
          aria-label="Branch name"
        />
      ) : (
        <div className="px-3 py-3 rounded-lg bg-surface border border-line font-mono text-[13px] leading-relaxed break-all select-all">
          <BranchName branch={editedBranch} />
        </div>
      )}

      {result.reason && <p className="mt-2 text-xs text-muted leading-relaxed">{result.reason}</p>}

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button onClick={() => handleCopy(editedBranch)} className="btn btn-primary btn-lg">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy branch'}
        </button>
        <button onClick={onRegenerate} disabled={isRegenerating} className="btn btn-secondary btn-lg">
          <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      </div>

      {alternatives.length > 0 && (
        <div className="mt-5 pt-3 border-t border-line">
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="w-full flex items-center justify-between text-xs font-medium text-muted hover:text-fg transition-colors"
            aria-expanded={showAlternatives}
          >
            <span>
              {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
          </button>

          {showAlternatives && (
            <ul className="mt-2 divide-y divide-line">
              {alternatives.map((alt) => (
                <li key={alt} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs leading-relaxed break-all">
                    <BranchName branch={alt} />
                  </span>
                  <button
                    onClick={() => handleCopy(alt)}
                    className="icon-btn shrink-0"
                    title="Copy alternative"
                    aria-label={`Copy ${alt}`}
                  >
                    {copiedBranch === alt ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
