import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Key,
  Sliders,
  History,
  Shield,
  Info,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { ProviderId, ModelInfo } from '../types/ai';
import { FlashXSettings, HistoryItem, BranchNamingConfig } from '../types/settings';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { credentialStorage } from '../storage/credentialStorage';
import { SettingsStorage } from '../storage/settingsStorage';
import { HistoryStorage } from '../storage/historyStorage';
import { TemplateEngine } from '../utils/templateEngine';
import { copyToClipboard } from '../utils/clipboard';
import { Header } from '../components/Header';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'ai' | 'naming' | 'jira' | 'history' | 'security' | 'about'
  >('ai');

  const [settings, setSettings] = useState<FlashXSettings | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    gemini: '',
    openai: '',
    claude: '',
  });
  const [showKeys, setShowKeys] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
    claude: false,
  });
  const [availableModels, setAvailableModels] = useState<Record<ProviderId, ModelInfo[]>>({
    gemini: [],
    openai: [],
    claude: [],
  });
  const [testStatuses, setTestStatuses] = useState<
    Record<ProviderId, { testing: boolean; result?: { success: boolean; message: string; latency?: number } }>
  >({
    gemini: { testing: false },
    openai: { testing: false },
    claude: { testing: false },
  });

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newPrefixInput, setNewPrefixInput] = useState('');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Load all initial state
  useEffect(() => {
    async function init() {
      const s = await SettingsStorage.getSettings();
      setSettings(s);

      const keys: Record<ProviderId, string> = { gemini: '', openai: '', claude: '' };
      for (const p of ['gemini', 'openai', 'claude'] as ProviderId[]) {
        const k = await credentialStorage.getApiKey(p);
        if (k) keys[p] = k;
      }
      setApiKeys(keys);

      const models: Record<ProviderId, ModelInfo[]> = { gemini: [], openai: [], claude: [] };
      for (const p of ['gemini', 'openai', 'claude'] as ProviderId[]) {
        const provider = ProviderFactory.getProvider(p);
        models[p] = await provider.getAvailableModels();
      }
      setAvailableModels(models);

      const hist = await HistoryStorage.getHistory();
      setHistoryItems(hist);
    }
    init();
  }, []);

  const handleSaveSettings = async (updated: Partial<FlashXSettings>) => {
    if (!settings) return;
    const newSettings = await SettingsStorage.updateSettings(updated);
    setSettings(newSettings);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const handleSaveApiKey = async (provider: ProviderId, key: string) => {
    if (!key.trim()) {
      await credentialStorage.removeApiKey(provider);
      setApiKeys((prev) => ({ ...prev, [provider]: '' }));
    } else {
      await credentialStorage.setApiKey(provider, key.trim());
      setApiKeys((prev) => ({ ...prev, [provider]: key.trim() }));
    }
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const handleTestConnection = async (providerId: ProviderId) => {
    const key = apiKeys[providerId];
    if (!key) return;

    setTestStatuses((prev) => ({ ...prev, [providerId]: { testing: true } }));
    const provider = ProviderFactory.getProvider(providerId);
    const selectedModel = settings?.selectedModels[providerId];

    try {
      const res = await provider.testConnection(key, selectedModel);
      setTestStatuses((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          result: { success: res.success, message: res.message, latency: res.latencyMs },
        },
      }));
    } catch (err: unknown) {
      setTestStatuses((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          result: { success: false, message: (err as Error)?.message || 'Test failed' },
        },
      }));
    }
  };

  const handleCopyHistory = async (branchName: string, id: string) => {
    const res = await copyToClipboard(branchName);
    if (res.success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    await HistoryStorage.deleteHistoryItem(id);
    setHistoryItems((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClearAllHistory = async () => {
    if (confirm('Are you sure you want to clear your entire branch generation history?')) {
      await HistoryStorage.clearHistory();
      setHistoryItems([]);
    }
  };

  const handleAddPrefix = () => {
    if (!settings || !newPrefixInput.trim()) return;
    let p = newPrefixInput.trim().toLowerCase();
    if (!p.endsWith('/')) p += '/';

    if (!settings.naming.allowedPrefixes.includes(p)) {
      const updatedPrefixes = [...settings.naming.allowedPrefixes, p];
      handleSaveSettings({
        naming: { ...settings.naming, allowedPrefixes: updatedPrefixes },
      });
    }
    setNewPrefixInput('');
  };

  const handleRemovePrefix = (prefix: string) => {
    if (!settings) return;
    const updatedPrefixes = settings.naming.allowedPrefixes.filter((p) => p !== prefix);
    handleSaveSettings({
      naming: { ...settings.naming, allowedPrefixes: updatedPrefixes },
    });
  };

  const handleAddDomain = () => {
    if (!settings || !newDomainInput.trim()) return;
    const d = newDomainInput.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!settings.customJiraDomains.includes(d)) {
      handleSaveSettings({
        customJiraDomains: [...settings.customJiraDomains, d],
      });
    }
    setNewDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    if (!settings) return;
    handleSaveSettings({
      customJiraDomains: settings.customJiraDomains.filter((d) => d !== domain),
    });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Live branch name preview for template
  const sampleBranchPreview = TemplateEngine.render(
    {
      type: settings.naming.defaultPrefix || 'bugfix',
      ticket: 'PAY-123',
      description: 'fix-international-tax-calculation',
    },
    settings.naming
  );

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      item.issueKey.toLowerCase().includes(q) ||
      item.issueTitle.toLowerCase().includes(q) ||
      item.branchName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16">
      <Header showSettingsButton={false} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              FlashX Preferences
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure your AI providers, branch conventions, and Jira workspace rules.
            </p>
          </div>

          {saveSuccessNotice && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 my-6 overflow-x-auto">
          {[
            { id: 'ai', label: 'AI Providers & BYOK', icon: Cpu },
            { id: 'naming', label: 'Branch Naming Rules', icon: Sliders },
            { id: 'jira', label: 'Jira Integration', icon: Zap },
            { id: 'history', label: 'Generation History', icon: History },
            { id: 'security', label: 'Security & Privacy', icon: Shield },
            { id: 'about', label: 'About', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: AI Providers & BYOK Credentials */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-start space-x-3">
              <Key className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Direct Bring-Your-Own-Key (BYOK) Architecture</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  FlashX communicates directly from your browser to Google AI Studio, OpenAI, or Anthropic.
                  No proxy servers. No storage of keys on our servers. You have complete control.
                </p>
              </div>
            </div>

            {/* Provider selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Provider
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'gemini' as ProviderId, name: 'Google Gemini', tag: 'Free tier available' },
                  { id: 'openai' as ProviderId, name: 'OpenAI', tag: 'GPT-4o Mini' },
                  { id: 'claude' as ProviderId, name: 'Anthropic Claude', tag: 'Claude 3.5 Haiku' },
                ].map((p) => {
                  const isSelected = settings.activeProvider === p.id;
                  const hasKey = !!apiKeys[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSaveSettings({ activeProvider: p.id })}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <span className="text-[10px] text-slate-400 mb-2">{p.tag}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md inline-block self-start ${
                          hasKey
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                        }`}
                      >
                        {hasKey ? 'Key Configured' : 'Key Missing'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Provider detail cards */}
            <div className="space-y-4 pt-2">
              {(['gemini', 'openai', 'claude'] as ProviderId[]).map((pid) => {
                const provider = ProviderFactory.getProvider(pid);
                const models = availableModels[pid] || [];
                const currentModel = settings.selectedModels[pid] || provider.defaultModel;
                const key = apiKeys[pid] || '';
                const show = showKeys[pid];
                const status = testStatuses[pid];

                return (
                  <div
                    key={pid}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {provider.name}
                        </h3>
                        {settings.activeProvider === pid && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
                            Active
                          </span>
                        )}
                      </div>

                      {/* External API Key link */}
                      <a
                        href={
                          pid === 'gemini'
                            ? 'https://aistudio.google.com/app/apikey'
                            : pid === 'openai'
                            ? 'https://platform.openai.com/api-keys'
                            : 'https://console.anthropic.com/settings/keys'
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                      >
                        <span>Get API Key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Model Picker */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Configured Model
                      </label>
                      <select
                        value={currentModel}
                        onChange={(e) => {
                          const updated = {
                            ...settings.selectedModels,
                            [pid]: e.target.value,
                          };
                          handleSaveSettings({ selectedModels: updated });
                        }}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.isFreeTier ? '(Free tier)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>API Key</span>
                        {key && (
                          <button
                            onClick={() => handleSaveApiKey(pid, '')}
                            className="text-[10px] text-rose-500 hover:underline flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove Key</span>
                          </button>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={show ? 'text' : 'password'}
                          placeholder={
                            pid === 'gemini'
                              ? 'AIzaSy...'
                              : pid === 'openai'
                              ? 'sk-...'
                              : 'sk-ant-...'
                          }
                          value={key}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiKeys((prev) => ({ ...prev, [pid]: val }));
                          }}
                          onBlur={(e) => handleSaveApiKey(pid, e.target.value)}
                          className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 pr-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeys((prev) => ({ ...prev, [pid]: !prev[pid] }))
                          }
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Test Connection Button */}
                    <div className="flex items-center space-x-3 pt-1">
                      <button
                        onClick={() => handleTestConnection(pid)}
                        disabled={!key || status.testing}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition flex items-center space-x-1.5"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${status.testing ? 'animate-spin' : ''}`}
                        />
                        <span>{status.testing ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      {status.result && (
                        <span
                          className={`text-xs font-medium flex items-center space-x-1.5 ${
                            status.result.success
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <span>{status.result.message}</span>
                          {status.result.latency && (
                            <span className="text-[10px] text-slate-400">
                              ({status.result.latency}ms)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Branch Naming Rules */}
        {activeTab === 'naming' && (
          <div className="space-y-6">
            {/* Live Preview Box */}
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                Live Output Preview
              </span>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 font-mono text-xs text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 break-all select-all">
                {sampleBranchPreview}
              </div>
            </div>

            {/* Template format */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Naming Template
              </label>
              <p className="text-[11px] text-slate-500">
                Use variables: <code className="text-indigo-500">{"{type}"}</code>, <code className="text-indigo-500">{"{ticket}"}</code>, <code className="text-indigo-500">{"{description}"}</code>
              </p>
              <input
                type="text"
                value={settings.naming.template}
                onChange={(e) =>
                  handleSaveSettings({
                    naming: { ...settings.naming, template: e.target.value },
                  })
                }
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                {[
                  '{type}/{ticket}-{description}',
                  '{ticket}/{type}-{description}',
                  '{type}/{description}-{ticket}',
                  '{type}/{ticket}_{description}',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() =>
                      handleSaveSettings({
                        naming: { ...settings.naming, template: tpl },
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator & Casing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Word Separator</label>
                <select
                  value={settings.naming.separator}
                  onChange={(e) =>
                    handleSaveSettings({
                      naming: {
                        ...settings.naming,
                        separator: e.target.value as BranchNamingConfig['separator'],
                      },
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value="/">Slash (/)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Casing Style</label>
                <select
                  value={settings.naming.casing}
                  onChange={(e) =>
                    handleSaveSettings({
                      naming: {
                        ...settings.naming,
                        casing: e.target.value as BranchNamingConfig['casing'],
                      },
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="lowercase">All lowercase (bugfix/pay-123-tax)</option>
                  <option value="preserve-ticket">Uppercase ticket (bugfix/PAY-123-tax)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  Max Branch Length ({settings.naming.maxLength} chars)
                </label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="5"
                  value={settings.naming.maxLength}
                  onChange={(e) =>
                    handleSaveSettings({
                      naming: {
                        ...settings.naming,
                        maxLength: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full mt-2 accent-indigo-600"
                />
              </div>
            </div>

            {/* Allowed Prefixes Manager */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Allowed Branch Prefixes
              </label>
              <div className="flex flex-wrap gap-2">
                {settings.naming.allowedPrefixes.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    <span>{p}</span>
                    <button
                      onClick={() => handleRemovePrefix(p)}
                      className="text-slate-400 hover:text-rose-500 ml-1"
                      title="Remove prefix"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center space-x-2 max-w-xs pt-1">
                <input
                  type="text"
                  placeholder="e.g. experiment/"
                  value={newPrefixInput}
                  onChange={(e) => setNewPrefixInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPrefix()}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex-1"
                />
                <button
                  onClick={handleAddPrefix}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Jira Integration */}
        {activeTab === 'jira' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Supported Jira Instances
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                By default, FlashX automatically detects Jira Cloud pages on <code className="text-indigo-500">https://*.atlassian.net/*</code>.
                If your company uses a custom domain (e.g. <code className="text-indigo-500">jira.company.com</code>), add it below.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold">Custom Jira Hostnames</label>
              {settings.customJiraDomains.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No custom domains added.</p>
              ) : (
                <div className="space-y-2">
                  {settings.customJiraDomains.map((d) => (
                    <div
                      key={d}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono max-w-md"
                    >
                      <span>{d}</span>
                      <button
                        onClick={() => handleRemoveDomain(d)}
                        className="text-rose-500 hover:underline text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-2 max-w-sm pt-1">
                <input
                  type="text"
                  placeholder="jira.mycompany.com"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex-1"
                />
                <button
                  onClick={handleAddDomain}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Domain</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Generation History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Search history by ticket or branch..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-72"
              />

              {historyItems.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                >
                  Clear All History
                </button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No generated branch history found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between"
                  >
                    <div className="space-y-1 overflow-hidden mr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                          {item.issueKey}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.issueTitle}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                        {item.branchName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleString()} • {item.provider} ({item.model})
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleCopyHistory(item.branchName, item.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600"
                        title="Copy branch name"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(item.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Security & Privacy */}
        {activeTab === 'security' && (
          <div className="space-y-4 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span>Security & Privacy Architecture</span>
              </h3>
              <p>
                FlashX is built for privacy-conscious software engineers and enterprise security policies.
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Local Storage Only:</strong> Your API keys are stored solely in <code className="text-indigo-500">chrome.storage.local</code> within your browser.
                </li>
                <li>
                  <strong>Never Synced to Cloud:</strong> FlashX explicitly disables Chrome Sync for credentials so keys are never synced across machines.
                </li>
                <li>
                  <strong>Zero Proxy Servers:</strong> LLM requests are dispatched directly from your browser to Google AI Studio, OpenAI, or Anthropic APIs.
                </li>
                <li>
                  <strong>Zero Analytics & Tracking:</strong> FlashX has no telemetry, no tracking cookies, and no third-party scripts.
                </li>
                <li>
                  <strong>Never Modifies Jira:</strong> FlashX is strictly read-only on your Jira tabs and cannot modify, comment, or edit tickets.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 space-y-1.5">
              <p className="font-semibold text-xs">Local Browser Storage Limitations Disclosure</p>
              <p className="text-[11px] leading-relaxed">
                Chrome extension local storage is sandboxed to the extension origin, but is not encrypted at rest with hardware-backed keys. If unauthorized actors have physical or administrative access to your computer, local browser profiles could potentially be inspected. You can delete your credentials in FlashX at any time.
              </p>
            </div>
          </div>
        )}

        {/* TAB 6: About FlashX */}
        {activeTab === 'about' && (
          <div className="max-w-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-center mx-auto">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-md">
              <Zap className="w-6 h-6 text-white fill-amber-300 stroke-indigo-900 stroke-1" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">FlashX</h2>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                From Jira to Git. In a flash.
              </p>
              <p className="text-xs text-slate-400 mt-1">Version 1.0.0 (Production Ready)</p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Production-ready Chrome browser extension that automatically understands Jira tickets and generates standardized, clean Git branch names using your preferred AI model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
