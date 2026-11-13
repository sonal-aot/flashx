import React from 'react';
import { Zap, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export const Logo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-md bg-accent text-on-accent ${
      size === 'lg' ? 'w-10 h-10 rounded-lg' : 'w-6 h-6'
    }`}
  >
    <Zap className={size === 'lg' ? 'w-5 h-5 fill-current' : 'w-3.5 h-3.5 fill-current'} />
  </span>
);

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => (
  <header className="flex items-center justify-between h-12 px-4 border-b border-line">
    <div className="flex items-center gap-2">
      <Logo />
      <span className="text-sm font-semibold tracking-tight">FlashX</span>
    </div>
    <div className="flex items-center gap-0.5">
      <ThemeToggle />
      <button onClick={onOpenSettings} className="icon-btn" title="Settings" aria-label="Open settings">
        <Settings className="w-4 h-4" />
      </button>
    </div>
  </header>
);
