import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, GitBranch, ChevronDown } from 'lucide-react';
import { JiraIssue } from '../types/jira';
import { BranchGenerationResult, ModelInfo, ProviderId } from '../types/ai';
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
import { JiraCloudAdapter } from '../features/jira/cloudAdapter';

const PROVIDER_IDS: ProviderId[] = ['gemini', 'openai', 'claude'];

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
        const isJiraUrl = new JiraCloudAdapter().isMatch(currentUrl, settings?.customJiraDomains);

        if (!isJiraUrl) {
          setIssue(null);
          setIsLoadingIssue(false);
          return;
        }

        // Request issue from content script
        let response;
        try {
          response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_JIRA_ISSUE' });
        } catch {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content.js'],
            });
            response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_JIRA_ISSUE' });
          } catch {
            setIssue(null);
            return;
          }
        }

        if (response && response.success && response.issue) {
          setIssue(response.issue);
        } else {
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

  // Re-scan only once settings load (or Jira domains change), not on every model switch.
  const settingsLoaded = settings !== null;
  useEffect(() => {
    if (settingsLoaded) {
      scanActiveTab();
    }
  }, [settingsLoaded, scanActiveTab]);

  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderId, ModelInfo[]>>>({});
  useEffect(() => {
    Promise.all(
      PROVIDER_IDS.map(async (id) => [id, await ProviderFactory.getProvider(id).getAvailableModels()] as const)
    ).then((entries) => setModelsByProvider(Object.fromEntries(entries)));
  }, []);

  const handleModelChange = async (value: string) => {
    if (!settings) return;
    const [providerId, ...rest] = value.split(':');
    const model = rest.join(':');
    const pid = providerId as ProviderId;
    const updated = await SettingsStorage.updateSettings({
      activeProvider: pid,
      selectedModels: { ...settings.selectedModels, [pid]: model },
    });
    setSettings(updated);
    setHasApiKey(await credentialStorage.hasApiKey(pid));
  };

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

  const activeModelId = settings
    ? settings.selectedModels[settings.activeProvider] || ProviderFactory.getProvider(settings.activeProvider).defaultModel
    : '';

  return (
    <div className="flex flex-col min-h-[500px] w-full bg-canvas text-fg">
      <Header onOpenSettings={handleOpenSettings} />

      <main className="flex-1 px-4 py-5 space-y-5">
        <JiraCard issue={issue} isLoading={isLoadingIssue} onRefresh={scanActiveTab} />

        {issue && (
          <div className="space-y-3">
            {!generationResult && (
              <button onClick={handleGenerate} disabled={isGenerating} className="btn btn-primary btn-lg w-full">
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : 'Generate branch'}
              </button>
            )}

            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">Model</span>
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasApiKey ? 'bg-success' : 'bg-warn'}`}
                  title={hasApiKey ? 'API key configured' : 'API key missing'}
                  aria-hidden="true"
                />
                <span className="relative min-w-0 flex">
                  <select
                    value={settings ? `${settings.activeProvider}:${activeModelId}` : ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={!settings || isGenerating}
                    className="min-w-0 max-w-[250px] h-7 pl-2 pr-6 rounded-md bg-surface border border-line text-fg text-[11px] font-mono truncate cursor-pointer hover:border-line-strong focus:outline-none focus:border-accent/70 appearance-none"
                  >
                    {PROVIDER_IDS.map((pid) => {
                      const models = modelsByProvider[pid] ?? [];
                      const selected = settings?.selectedModels[pid];
                      // Keep the saved model selectable even if it's no longer in the list.
                      const list =
                        selected && !models.some((m) => m.id === selected)
                          ? [{ id: selected, name: selected } as ModelInfo, ...models]
                          : models;
                      return (
                        <optgroup key={pid} label={ProviderFactory.getProvider(pid).name}>
                          {list.map((m) => (
                            <option key={m.id} value={`${pid}:${m.id}`}>
                              {m.id}
                              {m.isFreeTier ? ' · free' : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </span>
              </span>
            </label>
          </div>
        )}

        {issue && !hasApiKey && (
          <p className="text-xs text-muted">
            No {activeProviderName} key yet.{' '}
            <button onClick={handleOpenSettings} className="text-warn hover:underline underline-offset-2">
              Add API key
            </button>
          </p>
        )}

        {errorMessage && (
          <ErrorAlert
            message={errorMessage}
            onRetry={handleGenerate}
            onOpenSettings={handleOpenSettings}
          />
        )}

        {generationResult && (
          <div className="pt-5 border-t border-line">
            <BranchResultCard result={generationResult} onRegenerate={handleGenerate} isRegenerating={isGenerating} />
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between h-10 px-4 border-t border-line text-[11px] text-subtle">
        <span>Keys stay in your browser</span>
        <button onClick={handleOpenSettings} className="shrink-0 hover:text-fg transition-colors">
          Settings
        </button>
      </footer>

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
