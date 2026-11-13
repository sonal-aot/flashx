import React from 'react';
import { Zap } from 'lucide-react';

export const Logo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <span
    className={`inline-flex items-center justify-center bg-accent text-on-accent ${
      size === 'lg' ? 'w-10 h-10 rounded-lg' : 'w-6 h-6 rounded-md'
    }`}
  >
    <Zap className={size === 'lg' ? 'w-5 h-5 fill-current' : 'w-3.5 h-3.5 fill-current'} />
  </span>
);
