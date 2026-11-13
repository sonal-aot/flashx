import React, { useState, useEffect } from 'react';
import {
  Cpu,
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
  ChevronDown,
  X,
  Zap,
} from 'lucide-react';
import { ProviderId, ModelInfo } from '../types/ai';
import { FlashXSettings, HistoryItem, BranchNamingConfig } from '../types/settings';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { credentialStorage } from '../storage/credentialStorage';
import { SettingsStorage } from '../storage/settingsStorage';
import { HistoryStorage } from '../storage/historyStorage';
import { copyToClipboard } from '../utils/clipboard';
import { Logo } from '../components/Header';
import { ThemeToggle } from '../components/ThemeToggle';

const TABS = [
  { id: 'ai', label: 'AI Providers', icon: Cpu, title: 'AI Providers & BYOK', desc: 'FlashX calls Google AI Studio, OpenAI, or Anthropic directly from your browser. No proxy servers; keys never leave this device.' },
  { id: 'naming', label: 'Branch Naming', icon: Sliders, title: 'Branch Naming Rules', desc: 'Define the template, casing, and prefixes every generated branch must follow.' },
  { id: 'jira', label: 'Jira Integration', icon: Zap, title: 'Jira Integration', desc: 'Control which Jira hosts FlashX reads tickets from.' },
  { id: 'history', label: 'History', icon: History, title: 'Generation History', desc: 'Branches you have generated, stored locally in this browser.' },
  { id: 'security', label: 'Security & Privacy', icon: Shield, title: 'Security & Privacy', desc: 'How FlashX handles your credentials and ticket data.' },
  { id: 'about', label: 'About', icon: Info, title: 'About FlashX', desc: '' },
] as const;

const PROVIDERS: { id: ProviderId; name: string; tag: string; keyUrl: string; placeholder: string }[] = [
  { id: 'gemini', name: 'Google Gemini', tag: 'Free tier available', keyUrl: 'https://aistudio.google.com/app/apikey', placeholder: 'AIzaSy…' },
  { id: 'openai', name: 'OpenAI', tag: 'GPT-4o Mini', keyUrl: 'https://platform.openai.com/api-keys', placeholder: 'sk-…' },
  { id: 'claude', name: 'Anthropic Claude', tag: 'Claude 3.5 Haiku', keyUrl: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-…' },
];

const Row: React.FC<{ label: string; help?: React.ReactNode; htmlFor?: string; children: React.ReactNode }> = ({ label, help, htmlFor, children }) => (
  <div className="py-6 grid gap-3 md:grid-cols-[220px_1fr] md:gap-8">
    <div>
      <label htmlFor={htmlFor} className="text-[13px] font-medium">{label}</label>
      {help && <p className="mt-1 text-xs text-muted leading-relaxed">{help}</p>}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

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
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <RefreshCw className="w-5 h-5 animate-spin text-subtle" />
      </div>
    );
  }

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      item.issueKey.toLowerCase().includes(q) ||
      item.issueTitle.toLowerCase().includes(q) ||
      item.branchName.toLowerCase().includes(q)
    );
  });

  const current = TABS.find((t) => t.id === activeTab)!;
  const saveNaming = (patch: Partial<BranchNamingConfig>) =>
    handleSaveSettings({ naming: { ...settings.naming, ...patch } });

  return (
    <div className="min-h-screen bg-canvas text-fg md:flex">
      {/* Sidebar */}
      <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-line flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 h-16 px-6">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">FlashX</span>
        </div>
        <nav className="flex md:flex-col gap-0.5 p-2 md:px-3 overflow-x-auto flex-1" aria-label="Settings sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 h-8 px-3 rounded-md text-[13px] whitespace-nowrap transition-colors ${
                  isActive ? 'bg-raised text-fg font-medium' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent-text' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="hidden md:flex items-center justify-between px-6 h-14 border-t border-line text-[11px] text-subtle">
          <span>Version 1.0.0</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl px-6 md:px-12 py-10 md:py-14">
          <header className="pb-8 border-b border-line flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
              {current.desc && <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-xl">{current.desc}</p>}
            </div>
            <span
              role="status"
              className={`flex items-center gap-1 text-xs text-accent-text transition-opacity ${saveSuccessNotice ? 'opacity-100' : 'opacity-0'}`}
            >
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          </header>

          {/* AI Providers & BYOK */}
          {activeTab === 'ai' && (
            <div className="divide-y divide-line">
              <Row label="Active provider" help="Used by the popup when you generate a branch.">
                <div className="rounded-lg border border-line divide-y divide-line" role="radiogroup">
                  {PROVIDERS.map((p) => {
                    const isSelected = settings.activeProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSaveSettings({ activeProvider: p.id })}
                        className={`w-full flex items-center gap-3 px-4 h-12 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          isSelected ? 'bg-surface' : 'hover:bg-surface'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                            isSelected ? 'border-accent' : 'border-line-strong'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </span>
                        <span className="text-[13px] font-medium">{p.name}</span>
                        <span className="text-xs text-subtle">{p.tag}</span>
                        <span className={`ml-auto text-xs ${apiKeys[p.id] ? 'text-success' : 'text-subtle'}`}>
                          {apiKeys[p.id] ? 'Key configured' : 'No key'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Row>

              <Row label="Credentials" help="Choose a model and add an API key for each provider you use.">
                <div className="rounded-lg border border-line divide-y divide-line">
                  {PROVIDERS.map((p) => {
                    const pid = p.id;
                    const provider = ProviderFactory.getProvider(pid);
                    const models = availableModels[pid] || [];
                    const currentModel = settings.selectedModels[pid] || provider.defaultModel;
                    const key = apiKeys[pid] || '';
                    const show = showKeys[pid];
                    const status = testStatuses[pid];

                    return (
                      <details key={pid} open={settings.activeProvider === pid} className="group">
                        <summary className="flex items-center gap-2 px-4 h-12 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-[13px] font-medium">{provider.name}</span>
                          {settings.activeProvider === pid && <span className="tag text-accent-text">Active</span>}
                          <ChevronDown className="ml-auto w-4 h-4 text-subtle transition-transform group-open:rotate-180" />
                        </summary>

                        <div className="px-4 pb-5 pt-1 space-y-4">
                          <div>
                            <label htmlFor={`model-${pid}`} className="field-label">Model</label>
                            <select
                              id={`model-${pid}`}
                              value={currentModel}
                              onChange={(e) =>
                                handleSaveSettings({ selectedModels: { ...settings.selectedModels, [pid]: e.target.value } })
                              }
                              className="input"
                            >
                              {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} {m.isFreeTier ? '(Free tier)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label htmlFor={`key-${pid}`} className="text-xs font-medium">API key</label>
                              <a href={p.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                                Get a key
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="relative">
                              <input
                                id={`key-${pid}`}
                                type={show ? 'text' : 'password'}
                                placeholder={p.placeholder}
                                value={key}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setApiKeys((prev) => ({ ...prev, [pid]: val }));
                                }}
                                onBlur={(e) => handleSaveApiKey(pid, e.target.value)}
                                className="input font-mono pr-9"
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <button
                                type="button"
                                onClick={() => setShowKeys((prev) => ({ ...prev, [pid]: !prev[pid] }))}
                                className="icon-btn absolute right-1 top-1"
                                aria-label={show ? 'Hide key' : 'Show key'}
                              >
                                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => handleTestConnection(pid)} disabled={!key || status.testing} className="btn btn-secondary">
                              <RefreshCw className={`w-3.5 h-3.5 ${status.testing ? 'animate-spin' : ''}`} />
                              {status.testing ? 'Testing…' : 'Test connection'}
                            </button>
                            {key && (
                              <button onClick={() => handleSaveApiKey(pid, '')} className="btn btn-danger">
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove key
                              </button>
                            )}
                          </div>

                          {status.result && (
                            <p className={`text-xs leading-relaxed ${status.result.success ? 'text-success' : 'text-danger'}`}>
                              {status.result.message}
                              {status.result.latency && <span className="text-subtle"> · {status.result.latency}ms</span>}
                            </p>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </Row>
            </div>
          )}

          {/* Branch Naming Rules */}
          {activeTab === 'naming' && (
            <div className="divide-y divide-line">
              <Row
                label="Naming template"
                htmlFor="template"
                help={
                  <>
                    Variables: <code className="font-mono text-fg">{'{type}'}</code>, <code className="font-mono text-fg">{'{ticket}'}</code>,{' '}
                    <code className="font-mono text-fg">{'{description}'}</code>
                  </>
                }
              >
                <input
                  id="template"
                  type="text"
                  value={settings.naming.template}
                  onChange={(e) => saveNaming({ template: e.target.value })}
                  className="input font-mono"
                  spellCheck={false}
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    '{type}/{ticket}-{description}',
                    '{ticket}/{type}-{description}',
                    '{type}/{description}-{ticket}',
                    '{type}/{ticket}_{description}',
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => saveNaming({ template: tpl })}
                      aria-pressed={settings.naming.template === tpl}
                      className={`btn h-7 px-2 font-mono text-[11px] font-normal border ${
                        settings.naming.template === tpl
                          ? 'border-accent/60 text-fg bg-raised'
                          : 'border-line text-muted hover:text-fg hover:border-line-strong'
                      }`}
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Word separator" htmlFor="separator">
                <select
                  id="separator"
                  value={settings.naming.separator}
                  onChange={(e) => saveNaming({ separator: e.target.value as BranchNamingConfig['separator'] })}
                  className="input max-w-xs"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value="/">Slash (/)</option>
                </select>
              </Row>

              <Row label="Casing" htmlFor="casing">
                <select
                  id="casing"
                  value={settings.naming.casing}
                  onChange={(e) => saveNaming({ casing: e.target.value as BranchNamingConfig['casing'] })}
                  className="input max-w-xs"
                >
                  <option value="lowercase">All lowercase (bugfix/pay-123-tax)</option>
                  <option value="preserve-ticket">Uppercase ticket (bugfix/PAY-123-tax)</option>
                </select>
              </Row>

              <Row label="Maximum length" htmlFor="maxlen" help="Longer names are trimmed at a word boundary.">
                <div className="flex items-center gap-4 max-w-sm">
                  <input
                    id="maxlen"
                    type="range"
                    min="30"
                    max="100"
                    step="5"
                    value={settings.naming.maxLength}
                    onChange={(e) => saveNaming({ maxLength: Number(e.target.value) })}
                    className="flex-1 accent-accent"
                  />
                  <span className="font-mono text-xs w-14 text-right">{settings.naming.maxLength} chars</span>
                </div>
              </Row>

              <Row label="Allowed prefixes" htmlFor="new-prefix" help="Generated branches must start with one of these.">
                <div className="flex flex-wrap gap-1.5">
                  {settings.naming.allowedPrefixes.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md bg-surface border border-line font-mono text-xs">
                      {p}
                      <button
                        onClick={() => handleRemovePrefix(p)}
                        className="w-5 h-5 inline-flex items-center justify-center rounded text-subtle hover:text-danger"
                        aria-label={`Remove ${p}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 max-w-sm mt-3">
                  <input
                    id="new-prefix"
                    type="text"
                    placeholder="experiment/"
                    value={newPrefixInput}
                    onChange={(e) => setNewPrefixInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPrefix()}
                    className="input font-mono"
                  />
                  <button onClick={handleAddPrefix} className="btn btn-secondary h-9">
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </Row>
            </div>
          )}

          {/* Jira Integration */}
          {activeTab === 'jira' && (
            <div className="divide-y divide-line">
              <Row
                label="Jira Cloud"
                help="Detected automatically. No setup needed."
              >
                <code className="font-mono text-xs">https://*.atlassian.net/*</code>
              </Row>
              <Row
                label="Custom hostnames"
                htmlFor="new-domain"
                help={<>For self-hosted or custom domains, such as <code className="font-mono text-fg">jira.company.com</code>.</>}
              >
                {settings.customJiraDomains.length === 0 ? (
                  <p className="text-xs text-subtle">No custom hostnames added.</p>
                ) : (
                  <ul className="rounded-lg border border-line divide-y divide-line">
                    {settings.customJiraDomains.map((d) => (
                      <li key={d} className="flex items-center justify-between h-10 px-3">
                        <span className="font-mono text-xs">{d}</span>
                        <button onClick={() => handleRemoveDomain(d)} className="btn btn-tertiary h-7 hover:text-danger">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 max-w-sm mt-3">
                  <input
                    id="new-domain"
                    type="text"
                    placeholder="jira.mycompany.com"
                    value={newDomainInput}
                    onChange={(e) => setNewDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                    className="input font-mono"
                  />
                  <button onClick={handleAddDomain} className="btn btn-secondary h-9">
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </Row>
            </div>
          )}

          {/* Generation History */}
          {activeTab === 'history' && (
            <div className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="search"
                  placeholder="Search by ticket, title, or branch"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="input max-w-xs"
                  aria-label="Search history"
                />
                {historyItems.length > 0 && (
                  <button onClick={handleClearAllHistory} className="btn btn-danger">
                    Clear history
                  </button>
                )}
              </div>

              {filteredHistory.length === 0 ? (
                <p className="py-16 text-center text-xs text-subtle">
                  {historyItems.length === 0 ? 'No branches generated yet.' : 'No matches.'}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {filteredHistory.map((item) => (
                    <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-accent-text shrink-0">{item.issueKey}</span>
                          <span className="text-muted truncate">{item.issueTitle}</span>
                        </div>
                        <div className="font-mono text-[13px] break-all">{item.branchName}</div>
                        <div className="text-[11px] text-subtle">
                          {new Date(item.timestamp).toLocaleString()} · {item.provider} · {item.model}
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => handleCopyHistory(item.branchName, item.id)}
                          className="icon-btn"
                          title="Copy branch name"
                          aria-label="Copy branch name"
                        >
                          {copiedId === item.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(item.id)}
                          className="icon-btn hover:text-danger"
                          title="Delete entry"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Security & Privacy */}
          {activeTab === 'security' && (
            <div>
              <dl className="divide-y divide-line">
                {[
                  ['Local storage only', <>API keys are stored solely in <code className="font-mono text-fg">chrome.storage.local</code> in this browser.</>],
                  ['Never synced', 'Credentials are excluded from Chrome Sync, so keys never travel between machines.'],
                  ['No proxy servers', 'Requests go directly from your browser to Google AI Studio, OpenAI, or Anthropic.'],
                  ['No analytics', 'No telemetry, no tracking cookies, and no third-party scripts.'],
                  ['Read-only on Jira', 'FlashX cannot modify, comment on, or edit tickets.'],
                ].map(([title, body]) => (
                  <div key={title as string} className="py-5 grid gap-1 md:grid-cols-[220px_1fr] md:gap-8">
                    <dt className="text-[13px] font-medium">{title}</dt>
                    <dd className="text-[13px] text-muted leading-relaxed">{body}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 pl-4 border-l-2 border-warn">
                <p className="text-[13px] font-medium">Local storage limitations</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Extension storage is sandboxed to FlashX but is not encrypted at rest with hardware-backed keys. Anyone with
                  physical or administrative access to this computer could inspect the browser profile. You can remove your
                  credentials at any time from AI Providers.
                </p>
              </div>
            </div>
          )}

          {/* About */}
          {activeTab === 'about' && (
            <div className="pt-8 space-y-5 max-w-lg">
              <Logo size="lg" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">From Jira to Git. In a flash.</h2>
                <p className="mt-1 text-xs text-subtle">Version 1.0.0</p>
              </div>
              <p className="text-[13px] text-muted leading-relaxed">
                FlashX reads the Jira ticket you have open and generates a clean, convention-compliant Git branch name using
                the AI provider you choose, or its built-in local engine when you are offline.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
