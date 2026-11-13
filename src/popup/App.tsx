import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, Sparkles } from 'lucide-react';
import { JiraIssue } from '../types/jira';
import { BranchGenerationResult } from '../types/ai';
import { FlashXSettings } from '../types/settings';
import { Header } from '../components/Header';
import { JiraCard } from '../components/JiraCard';
import { BranchResultCard } from '../components/BranchResultCard';
import { ErrorAlert } from '../components/ErrorAlert';
import { OnboardingModal } from '../components/OnboardingModal';
import { SettingsStorage } from '../storage/settingsStorage';
import { credentialStorage } from '../storage/credentialStorage';
import { BranchGenerator } from '../features/branch-generator/branchGenerator';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { copyToClipboard } from '../utils/clipboard';

// Sample demo issue for instant testing without an active Jira instance
const DEMO_JIRA_ISSUE: JiraIssue = {
  key: 'PAY-123',
  title: 'Fix incorrect tax calculation for international orders',
  description:
    'Tax calculation currently uses the domestic tax rate for international orders. Update the calculation logic to apply the correct country-specific rate.',
  issueType: 'Bug',
  projectKey: 'PAY',
  url: 'https://jira.example.com/browse/PAY-123',
  priority: 'High',
  status: 'In Progress',
  detectedAt: Date.now(),
};

export const App: React.FC = () => {
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [isLoadingIssue, setIsLoadingIssue] = useState(true);
  const [settings, setSettings] = useState<FlashXSettings | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<BranchGenerationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Load Settings and API Key state
  const loadSettingsAndAuth = useCallback(async () => {
    const s = await SettingsStorage.getSettings();
    setSettings(s);

    const hasKey = await credentialStorage.hasApiKey(s.activeProvider);
    setHasApiKey(hasKey);

    if (!s.hasCompletedOnboarding && !hasKey) {
      setShowOnboarding(true);
    }
  }, []);

  // Fetch current Jira issue from active tab
  const scanActiveTab = useCallback(async () => {
    setIsLoadingIssue(true);
    setErrorMessage(null);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
          setIsLoadingIssue(false);
          return;
        }

        // Check if URL matches Jira
        const currentUrl = activeTab.url || '';
        const isJiraUrl =
          currentUrl.includes('.atlassian.net') ||
          (settings?.customJiraDomains || []).some((d) => currentUrl.includes(d));

        if (!isJiraUrl) {
          setIssue(null);
          setIsLoadingIssue(false);
          return;
        }

        // Request issue from content script
        try {
          const response = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'GET_JIRA_ISSUE',
          });

          if (response && response.success && response.issue) {
            setIssue(response.issue);
          } else {
            setIssue(null);
          }
        } catch (tabErr) {
          // Content script might not be injected yet or tab refreshed
          console.warn('[FlashX] Could not communicate with content script:', tabErr);
          setIssue(null);
        }
      } else {
        // Fallback for non-extension environment
        setIssue(null);
      }
    } catch (err) {
      console.warn('[FlashX] Error querying active tab:', err);
      setIssue(null);
    } finally {
      setIsLoadingIssue(false);
    }
  }, [settings?.customJiraDomains]);

  useEffect(() => {
    loadSettingsAndAuth();
  }, [loadSettingsAndAuth]);

  useEffect(() => {
    if (settings) {
      scanActiveTab();
    }
  }, [settings, scanActiveTab]);

  // Handle generation
  const handleGenerate = async () => {
    if (!issue) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const result = await BranchGenerator.generate(issue);
      setGenerationResult(result);

      // Auto-copy if configured
      if (settings?.autoCopy && result.recommended) {
        await copyToClipboard(result.recommended);
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Branch generation failed.';
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Offline fallback generation
  const handleOfflineGenerate = async () => {
    if (!issue) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const result = await BranchGenerator.generateOfflineFallback(issue);
      setGenerationResult(result);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Offline generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  const activeProviderName = settings
    ? ProviderFactory.getProvider(settings.activeProvider).name
    : 'AI';

  const activeModelName = settings?.selectedModels[settings.activeProvider] || '';

  return (
    <div className="flex flex-col min-h-[500px] w-full max-w-[420px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header onOpenSettings={handleOpenSettings} />

      <main className="p-4 flex-1 space-y-4">
        {/* Jira Issue Card */}
        <JiraCard
          issue={issue}
          isLoading={isLoadingIssue}
          onRefresh={scanActiveTab}
          onUseDemo={() => setIssue(DEMO_JIRA_ISSUE)}
        />

        {/* Error Alert */}
        {errorMessage && (
          <ErrorAlert
            message={errorMessage}
            onRetry={handleGenerate}
            onOpenSettings={handleOpenSettings}
            onUseOfflineFallback={handleOfflineGenerate}
          />
        )}

        {/* Generate Action Button */}
        {issue && !generationResult && (
          <div className="space-y-2 pt-1">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.99] shadow-sm shadow-indigo-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Branch Name...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-amber-300 stroke-indigo-900 stroke-1" />
                  <span>Generate Git Branch</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>
                  {activeProviderName} ({activeModelName})
                </span>
              </span>
              <button
                onClick={handleOfflineGenerate}
                className="hover:text-indigo-500 transition underline underline-offset-2"
                title="Generate instantly with local rule engine"
              >
                Offline Mode
              </button>
            </div>
          </div>
        )}

        {/* Generated Result Card */}
        {generationResult && (
          <div className="pt-1">
            <BranchResultCard
              result={generationResult}
              onRegenerate={handleGenerate}
              isRegenerating={isGenerating}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {activeProviderName}
          </span>
          {!hasApiKey && (
            <button
              onClick={handleOpenSettings}
              className="text-amber-600 dark:text-amber-400 font-semibold hover:underline text-[10px]"
            >
              (Key Missing)
            </button>
          )}
        </div>

        <button
          onClick={handleOpenSettings}
          className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition"
        >
          Settings
        </button>
      </footer>

      {/* First-time Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false);
            loadSettingsAndAuth();
          }}
        />
      )}
    </div>
  );
};
