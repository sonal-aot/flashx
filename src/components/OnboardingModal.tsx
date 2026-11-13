import React, { useState, useEffect } from 'react';
import { Check, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo } from './Header';
import { ProviderId, ModelInfo } from '../types/ai';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { credentialStorage } from '../storage/credentialStorage';
import { SettingsStorage } from '../storage/settingsStorage';

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const providers = [
    {
      id: 'gemini' as ProviderId,
      name: 'Google Gemini',
      tag: 'Recommended (Free Tier Available)',
      desc: 'Fast, powerful Gemini 3.8 Flash via Google AI Studio API key.',
    },
    {
      id: 'openai' as ProviderId,
      name: 'OpenAI',
      tag: 'GPT-4o Mini',
      desc: 'Fast, precise branch naming via your OpenAI API key.',
    },
    {
      id: 'claude' as ProviderId,
      name: 'Anthropic Claude',
      tag: 'Claude 3.5 Haiku',
      desc: 'High intelligence engineering classifications.',
    },
  ];

  // Update models when provider changes
  useEffect(() => {
    const provider = ProviderFactory.getProvider(selectedProvider);
    provider.getAvailableModels().then((models) => {
      setAvailableModels(models);
      setSelectedModel(provider.defaultModel);
    });
  }, [selectedProvider]);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const provider = ProviderFactory.getProvider(selectedProvider);
      const res = await provider.testConnection(apiKey.trim(), selectedModel);
      setTestResult({
        success: res.success,
        message: res.message,
      });

      // If test connection auto-switched to a working model, update state
      if (res.modelTested && res.modelTested !== selectedModel) {
        setSelectedModel(res.modelTested);
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: (err as Error)?.message || 'Connection test failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFinish = async () => {
    if (apiKey.trim()) {
      await credentialStorage.setApiKey(selectedProvider, apiKey.trim());
    }
    const currentSettings = await SettingsStorage.getSettings();
    await SettingsStorage.updateSettings({
      activeProvider: selectedProvider,
      selectedModels: {
        ...currentSettings.selectedModels,
        [selectedProvider]: selectedModel,
      },
      hasCompletedOnboarding: true,
    });
    onComplete();
  };

  const handleSkip = async () => {
    await SettingsStorage.updateSettings({
      hasCompletedOnboarding: true,
    });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-sm rounded-xl border border-line bg-canvas shadow-2xl flex flex-col">
        <div className="h-12 px-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span id="onboarding-title" className="text-sm font-semibold">Welcome to FlashX</span>
          </div>
          <span className="text-[11px] text-subtle">Step {step} of 3</span>
        </div>

        <div className="p-5 flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">From Jira to Git. In a flash.</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  FlashX reads the Jira ticket you have open, interprets the engineering intent, and generates a
                  convention-compliant Git branch name using the AI provider you choose.
                </p>
              </div>
              <div className="flex gap-2.5 pt-4 border-t border-line">
                <ShieldCheck className="w-4 h-4 text-accent-text shrink-0 mt-px" />
                <div>
                  <p className="text-xs font-medium">Bring your own key</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">
                    API keys stay in your browser. No middleman servers, and your Jira data is never logged.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Choose an AI provider</h3>
                <p className="text-xs text-muted mt-0.5">This model will power your branch names.</p>
              </div>
              <div className="rounded-lg border border-line divide-y divide-line" role="radiogroup">
                {providers.map((p) => {
                  const selected = selectedProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setSelectedProvider(p.id);
                        setTestResult(null);
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        selected ? 'bg-surface' : 'hover:bg-surface'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                          selected ? 'border-accent' : 'border-line-strong'
                        }`}
                      >
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </span>
                      <span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{p.name}</span>
                          <span className="text-[11px] text-subtle">{p.tag}</span>
                        </span>
                        <span className="block text-xs text-muted mt-0.5">{p.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Configure {selectedProvider === 'gemini' ? 'Google AI Studio' : selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
                </h3>
                <p className="text-xs text-muted mt-0.5">Pick a model and enter your API key. It is stored locally only.</p>
              </div>

              <div>
                <label htmlFor="ob-model" className="field-label">Model</label>
                <select
                  id="ob-model"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setTestResult(null);
                  }}
                  className="input"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isFreeTier ? '(Free tier)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ob-key" className="field-label">API key</label>
                <div className="relative">
                  <input
                    id="ob-key"
                    type={showKey ? 'text' : 'password'}
                    placeholder={selectedProvider === 'gemini' ? 'AIzaSy…' : selectedProvider === 'openai' ? 'sk-…' : 'sk-ant-…'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    className="input font-mono pr-9"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="icon-btn absolute right-1 top-1"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {apiKey.trim() && (
                <button onClick={handleTestConnection} disabled={isTesting} className="btn btn-secondary w-full">
                  {isTesting ? 'Testing connection…' : 'Test connection'}
                </button>
              )}

              {testResult && (
                <p className={`text-xs leading-relaxed ${testResult.success ? 'text-success' : 'text-danger'}`}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line flex items-center justify-between">
          <button onClick={handleSkip} className="btn btn-tertiary -ml-1.5">
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2)} className="btn btn-secondary">
                Back
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep((s) => (s + 1) as 2 | 3)} className="btn btn-primary">
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={handleFinish} className="btn btn-primary">
                Get started
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
