import React, { useState } from 'react';
import { Zap, Check, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { ProviderId } from '../types/ai';
import { ProviderFactory } from '../features/ai-providers/providerFactory';
import { credentialStorage } from '../storage/credentialStorage';
import { SettingsStorage } from '../storage/settingsStorage';

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const providers = [
    {
      id: 'gemini' as ProviderId,
      name: 'Google Gemini',
      tag: 'Recommended (Free Tier Available)',
      desc: 'Super-fast 2.0 Flash model via Google AI Studio API key.',
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

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const provider = ProviderFactory.getProvider(selectedProvider);
      const res = await provider.testConnection(apiKey.trim());
      setTestResult({
        success: res.success,
        message: res.message,
      });
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
    await SettingsStorage.updateSettings({
      activeProvider: selectedProvider,
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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Step indicator */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-amber-300" />
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Welcome to FlashX</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Step {step} of 3</span>
        </div>

        {/* Content body */}
        <div className="p-5 flex-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">From Jira to Git. In a flash.</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  FlashX automatically reads your open Jira ticket, interprets the engineering intent, and generates standard-compliant Git branch names using your choice of AI.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-left space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>BYOK Privacy Guarantee</span>
                </div>
                <p className="leading-snug text-slate-500 dark:text-slate-400">
                  Your API keys stay in your browser. FlashX has no middleman servers and never logs your Jira data.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Select your AI Provider</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose which LLM provider will power your branch names.</p>
              </div>

              <div className="space-y-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProvider(p.id);
                      setTestResult(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition flex items-start justify-between ${
                      selectedProvider === p.id
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</p>
                    </div>
                    {selectedProvider === p.id && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Enter {selectedProvider === 'gemini' ? 'Google AI Studio' : selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Stored strictly locally in your browser.
                </p>
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={
                    selectedProvider === 'gemini'
                      ? 'AIzaSy...'
                      : selectedProvider === 'openai'
                      ? 'sk-...'
                      : 'sk-ant-...'
                  }
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 pr-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {apiKey.trim() && (
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="w-full py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  {isTesting ? 'Testing connection...' : 'Test Connection'}
                </button>
              )}

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] border leading-snug ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Skip for now
          </button>

          <div className="flex items-center space-x-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center space-x-1"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center space-x-1"
              >
                <span>Get Started</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
