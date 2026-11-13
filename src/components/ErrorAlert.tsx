import React from 'react';
import { AlertTriangle, Key, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry, onOpenSettings }) => {
  const lower = message.toLowerCase();
  const isKeyError = lower.includes('api key') || lower.includes('credentials') || lower.includes('unauthorized');

  return (
    <div role="alert" className="p-3 rounded-lg border border-danger/40 bg-danger/5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-px" />
        <p className="text-xs leading-relaxed">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 pl-6">
        {isKeyError && onOpenSettings && (
          <button onClick={onOpenSettings} className="btn btn-secondary">
            <Key className="w-3.5 h-3.5" />
            Configure key
          </button>
        )}
        {onRetry && (
          <button onClick={onRetry} className="btn btn-tertiary">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
