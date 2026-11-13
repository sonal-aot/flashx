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

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;

  return (
    <button
      onClick={toggle}
      className="icon-btn"
      title={`Theme: ${theme} (click to change)`}
      aria-label="Change theme"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};
