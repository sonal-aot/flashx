import React from 'react';
import { Zap, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onOpenSettings?: () => void;
  showSettingsButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  showSettingsButton = true,
}) => {
  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center space-x-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-sm shadow-indigo-500/20">
          <Zap className="w-4 h-4 text-white fill-amber-300 stroke-indigo-900 stroke-1" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              FlashX
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              AI
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
            From Jira to Git. In a flash.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <ThemeToggle />
        {showSettingsButton && (
          <button
            onClick={handleOpenSettings}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open Settings"
            aria-label="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
