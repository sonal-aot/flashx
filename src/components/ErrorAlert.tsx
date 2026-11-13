import React from 'react';
import { AlertTriangle, Key, RefreshCw, Zap } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onUseOfflineFallback?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  onRetry,
  onOpenSettings,
  onUseOfflineFallback,
}) => {
  const isKeyError =
    message.toLowerCase().includes('api key') ||
    message.toLowerCase().includes('credentials') ||
    message.toLowerCase().includes('unauthorized');

  const isHighDemandOrOverload =
    message.includes('503') ||
    message.toLowerCase().includes('high demand') ||
    message.toLowerCase().includes('high traffic') ||
    message.toLowerCase().includes('rate limit') ||
    message.includes('429');

  return (
    <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200">
      <div className="flex items-start space-x-2.5">
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <p className="text-xs leading-relaxed font-medium">{message}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isKeyError && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition"
              >
                <Key className="w-3 h-3 mr-1" />
                Configure API Key
              </button>
            )}

            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </button>
            )}

            {onUseOfflineFallback && (
              <button
                onClick={onUseOfflineFallback}
                className={`inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md shadow-xs transition ${
                  isHighDemandOrOverload
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3 h-3 mr-1" />
                Generate Offline (Instant)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
