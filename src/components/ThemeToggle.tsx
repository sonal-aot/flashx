import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const toggle = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={`Current theme: ${theme} (click to toggle)`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
      {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
      {theme === 'system' && <Laptop className="w-4 h-4 text-slate-400" />}
    </button>
  );
};
