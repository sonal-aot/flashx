import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, GitBranch, ChevronDown, Settings } from 'lucide-react';
import { JiraIssue } from '../types/jira';
import { ModelInfo, ProviderId } from '../types/ai';
import { FlashXSettings } from '../types/settings';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo } from '../components/Logo';
import { JiraCard } from '../components/JiraCard';
import { BranchResultCard } from '../components/BranchResultCard';
import { ErrorAlert } from '../components/ErrorAlert';
import { OnboardingModal } from '../components/OnboardingModal';
import { SettingsStorage } from '../storage/settingsStorage';
import { credentialStorage } from '../storage/credentialStorage';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { copyToClipboard } from '../utils/clipboard';
import { JiraCloudAdapter } from '../features/jira/cloudAdapter';
import {
  GENERATE_MESSAGE,
  GenerationJob,
  getJob,
  jobStorageKey,
  saveJob,
} from '../features/branch-generator/generationJobs';

const PROVIDER_IDS: ProviderId[] = ['gemini', 'openai', 'claude'];

const openSettings = () => chrome.runtime.openOptionsPage();

export const App: React.FC = () => {
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [isLoadingIssue, setIsLoadingIssue] = useState(true);
  const [settings, setSettings] = useState<FlashXSettings | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const tabIdRef = useRef<number | undefined>(undefined);

  // Generation runs in the background worker; the popup only mirrors its job state,
  // so closing the popup (tab switch, click away) never loses a generation in flight.
  const [job, setJob] = useState<GenerationJob | null>(null);
  const isGenerating = job?.status === 'running';
  const generationResult = job?.result ?? null;
  const errorMessage = job?.status === 'error' ? job.error ?? 'Branch generation failed.' : null;

  const loadSettingsAndAuth = useCallback(async () => {
    const s = await SettingsStorage.getSettings();
    setSettings(s);
    const hasKey = await credentialStorage.hasApiKey(s.activeProvider);
    setHasApiKey(hasKey);
    if (!s.hasCompletedOnboarding && !hasKey) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    loadSettingsAndAuth();
  }, [loadSettingsAndAuth]);

  const customJiraDomains = settings?.customJiraDomains;
  const scanActiveTab = useCallback(async () => {
    setIsLoadingIssue(true);
    let found: JiraIssue | null = null;
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabIdRef.current = activeTab?.id;
      if (activeTab?.id && new JiraCloudAdapter().isMatch(activeTab.url || '', customJiraDomains)) {
        let response;
        try {
          response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_JIRA_ISSUE' });
        } catch {
          // Content script not injected yet (e.g. tab opened before install).
          await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });
          response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_JIRA_ISSUE' });
        }
        if (response?.success && response.issue) found = response.issue;
      }
    } catch (err) {
      console.warn('[FlashX] Error querying active tab:', err);
    }
    setIssue(found);
    setJob(found ? await getJob(found.key) : null);
    setIsLoadingIssue(false);
  }, [customJiraDomains]);

  const settingsLoaded = settings !== null;
  useEffect(() => {
    if (settingsLoaded) scanActiveTab();
  }, [settingsLoaded, scanActiveTab]);

  // Follow the background job for this ticket.
  const issueKey = issue?.key;
  useEffect(() => {
    if (!issueKey) return;
    const key = jobStorageKey(issueKey);
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session' && key in changes) setJob((changes[key].newValue as GenerationJob) ?? null);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [issueKey]);

  // First time a finished job is on screen: mark it seen (stops the reopen) and
  // honour auto-copy.
  useEffect(() => {
    if (!job || job.seen || job.status === 'running') return;
    saveJob({ ...job, seen: true });
    if (job.status === 'done' && settings?.autoCopy && job.result?.recommended) {
      copyToClipboard(job.result.recommended);
    }
  }, [job, settings?.autoCopy]);

  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderId, ModelInfo[]>>>({});
  useEffect(() => {
    Promise.all(
      PROVIDER_IDS.map(async (id) => [id, await ProviderFactory.getProvider(id).getAvailableModels()] as const)
    ).then((entries) => setModelsByProvider(Object.fromEntries(entries)));
  }, []);

  const handleModelChange = async (value: string) => {
    if (!settings) return;
    const [providerId, ...rest] = value.split(':');
    const pid = providerId as ProviderId;
    const updated = await SettingsStorage.updateSettings({
      activeProvider: pid,
      selectedModels: { ...settings.selectedModels, [pid]: rest.join(':') },
    });
    setSettings(updated);
    setHasApiKey(await credentialStorage.hasApiKey(pid));
  };

  const handleGenerate = () => {
    if (!issue || isGenerating) return;
    // Show the spinner immediately; the worker's own 'running' write follows.
    setJob((j) => ({ ...(j ?? { issueKey: issue.key, seen: true }), status: 'running', updatedAt: Date.now() }));
    chrome.runtime.sendMessage({ type: GENERATE_MESSAGE, issue, tabId: tabIdRef.current });
  };

  const handleOpenSettings = () => openSettings();

  const activeModelId = settings
    ? settings.selectedModels[settings.activeProvider] || ProviderFactory.getProvider(settings.activeProvider).defaultModel
    : '';

  return (
    <div className="flex flex-col min-h-[460px] w-full bg-canvas text-fg">
      <header className="flex items-center justify-between h-12 px-4 border-b border-line">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">FlashX</span>
        </div>
        <div className="flex items-center gap-0.5 -mr-1.5">
          <ThemeToggle />
          <button onClick={handleOpenSettings} className="icon-btn" title="Settings" aria-label="Open settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-5 space-y-5">
        <JiraCard issue={issue} isLoading={isLoadingIssue} onRefresh={scanActiveTab} />

        {issue && (
          <section className="space-y-3">
            {!generationResult && (
              <button onClick={handleGenerate} disabled={isGenerating} className="btn btn-primary btn-lg w-full">
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : 'Generate branch'}
              </button>
            )}

            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="model" className="text-muted shrink-0">
                Model
              </label>
              <span className="relative inline-flex min-w-0">
                <span
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${
                    hasApiKey ? 'bg-success' : 'bg-warn'
                  }`}
                  title={hasApiKey ? 'API key configured' : 'API key missing'}
                />
                <select
                  id="model"
                  value={settings ? `${settings.activeProvider}:${activeModelId}` : ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!settings || isGenerating}
                  className="w-full min-w-0 h-7 pl-6 pr-7 rounded-md bg-surface border border-line text-fg text-[11px] font-mono truncate cursor-pointer appearance-none hover:border-line-strong focus:outline-none focus:border-accent/70 disabled:opacity-60"
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
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-subtle" />
              </span>
              {!hasApiKey && (
                <button
                  onClick={handleOpenSettings}
                  className="shrink-0 whitespace-nowrap text-warn hover:underline underline-offset-2"
                >
                  Add key
                </button>
              )}
            </div>
          </section>
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

      <footer className="flex items-center h-10 px-4 border-t border-line text-[11px] text-subtle">
        Keys stay in your browser
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
