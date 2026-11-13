import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiProvider } from '../src/features/ai-providers/geminiProvider';
import { OpenAIProvider } from '../src/features/ai-providers/openAiProvider';
import { ClaudeProvider } from '../src/features/ai-providers/claudeProvider';
import { ProviderFactory } from '../features/../src/features/ai-providers/providerFactory';
import { DEFAULT_SETTINGS } from '../src/features/settings/defaultSettings';
import { JiraIssue } from '../src/types/jira';

describe('AI Providers', () => {
  const sampleIssue: JiraIssue = {
    key: 'PAY-123',
    title: 'Fix incorrect tax calculation for international orders',
    description: 'Update calculation logic to apply country-specific rate.',
    issueType: 'Bug',
    projectKey: 'PAY',
    url: 'https://jira.example.com/browse/PAY-123',
    detectedAt: Date.now(),
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('ProviderFactory', () => {
    it('retrieves registered providers by ID', () => {
      expect(ProviderFactory.getProvider('gemini')).toBeInstanceOf(GeminiProvider);
      expect(ProviderFactory.getProvider('openai')).toBeInstanceOf(OpenAIProvider);
      expect(ProviderFactory.getProvider('claude')).toBeInstanceOf(ClaudeProvider);
    });

    it('throws error for unknown provider ID', () => {
      expect(() => ProviderFactory.getProvider('unsupported' as any)).toThrow(
        'Unsupported AI provider'
      );
    });
  });

  describe('GeminiProvider', () => {
    it('generates branch names successfully with mocked Gemini response', async () => {
      const provider = new GeminiProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      recommended: 'bugfix/PAY-123-fix-international-tax',
                      alternatives: [
                        'bugfix/PAY-123-correct-tax-rate',
                        'bugfix/PAY-123-country-specific-tax',
                      ],
                      reason: 'Fixes tax calculation for international orders.',
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 120 },
        }),
      });

      const result = await provider.generateBranchName({
        issue: sampleIssue,
        config: DEFAULT_SETTINGS.naming,
        apiKey: 'AIzaSyFakeKey12345678901234567890',
        model: 'gemini-3.8-flash',
      });

      expect(result.recommended).toBe('bugfix/pay-123-fix-international-tax');
      expect(result.alternatives).toHaveLength(2);
      expect(result.tokensUsed).toBe(120);
    });

    it('asks Gemini 3+ for low thinking and retries without it if rejected', async () => {
      const provider = new GeminiProvider();
      const okBody = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    recommended: 'feat/PAY-123-tax',
                    alternatives: ['feat/PAY-123-a', 'feat/PAY-123-b'],
                    reason: 'r',
                  }),
                },
              ],
            },
          },
        ],
      };
      const ok = { ok: true, status: 200, json: async () => okBody };
      const rejectThinking = {
        ok: false,
        status: 400,
        clone: () => ({ json: async () => ({ error: { message: 'thinkingLevel is not supported' } }) }),
        json: async () => ({ error: { message: 'thinkingLevel is not supported' } }),
      };
      const sentConfig = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body).generationConfig;
      const req = { issue: sampleIssue, config: DEFAULT_SETTINGS.naming, apiKey: 'AIzaSyFakeKey' };

      globalThis.fetch = vi.fn().mockResolvedValue(ok);
      await provider.generateBranchName({ ...req, model: 'gemini-3.8-flash' });
      expect(sentConfig(vi.mocked(fetch).mock.calls[0]).thinkingConfig).toEqual({ thinkingLevel: 'LOW' });

      globalThis.fetch = vi.fn().mockResolvedValue(ok);
      await provider.generateBranchName({ ...req, model: 'gemini-2.5-flash-lite' });
      expect(sentConfig(vi.mocked(fetch).mock.calls[0]).thinkingConfig).toBeUndefined();

      globalThis.fetch = vi.fn().mockResolvedValueOnce(rejectThinking).mockResolvedValueOnce(ok);
      const result = await provider.generateBranchName({ ...req, model: 'gemini-3.8-flash' });
      expect(result.recommended).toBe('feat/pay-123-tax');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(sentConfig(vi.mocked(fetch).mock.calls[1]).thinkingConfig).toBeUndefined();
    });

    it('handles Gemini 429 rate limit error gracefully', async () => {
      const provider = new GeminiProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Quota exceeded for quota metric' } }),
      });

      await expect(
        provider.generateBranchName({
          issue: sampleIssue,
          config: DEFAULT_SETTINGS.naming,
          apiKey: 'AIzaSyFakeKey',
          model: 'gemini-3.8-flash',
        })
      ).rejects.toThrow('Gemini API rate limit reached');
    });

    it('stops on 503 so the caller can use its offline fallback', async () => {
      const provider = new GeminiProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: { message: 'The service is temporarily overloaded.' } }),
      });

      await expect(
        provider.generateBranchName({
          issue: sampleIssue,
          config: DEFAULT_SETTINGS.naming,
          apiKey: 'AIzaSyFakeKey',
          model: 'gemini-3.8-flash',
        })
      ).rejects.toThrow('temporarily unavailable (503)');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('tests connection successfully on 200', async () => {
      const provider = new GeminiProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const res = await provider.testConnection('AIzaSyValidKey');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully connected');
    });

    it('automatically falls back to accessible model when primary model returns 404', async () => {
      const provider = new GeminiProvider();

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        // First call with legacy-model returns 404
        if (url.includes('legacy-model')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({ error: { message: 'models/legacy-model is not found' } }),
          });
        }
        // Fallback models list query returns available models
        return Promise.resolve({
          ok: true,
          json: async () => ({
            models: [
              { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
            ],
          }),
        });
      });

      const res = await provider.testConnection('AIzaSyValidKey', 'legacy-model');
      expect(res.success).toBe(true);
      expect(res.modelTested).toBe('gemini-3.8-flash');
      expect(res.message).toContain('switched to accessible model "gemini-3.8-flash"');
    });
  });

  describe('OpenAIProvider', () => {
    it('generates branch names successfully with mocked OpenAI response', async () => {
      const provider = new OpenAIProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  recommended: 'bugfix/PAY-123-fix-tax-rate',
                  alternatives: ['bugfix/PAY-123-tax-calculation-fix'],
                  reason: 'Corrects tax calculation.',
                }),
              },
            },
          ],
          usage: { total_tokens: 85 },
        }),
      });

      const result = await provider.generateBranchName({
        issue: sampleIssue,
        config: DEFAULT_SETTINGS.naming,
        apiKey: 'sk-proj-fakekey12345678901234567890',
        model: 'gpt-4o-mini',
      });

      expect(result.recommended).toBe('bugfix/pay-123-fix-tax-rate');
      expect(result.tokensUsed).toBe(85);
    });

    it('handles OpenAI 401 unauthorized error gracefully', async () => {
      const provider = new OpenAIProvider();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Incorrect API key provided' } }),
      });

      await expect(
        provider.generateBranchName({
          issue: sampleIssue,
          config: DEFAULT_SETTINGS.naming,
          apiKey: 'sk-invalid',
          model: 'gpt-4o-mini',
        })
      ).rejects.toThrow('Invalid OpenAI API key');
    });
  });

  describe('ClaudeProvider', () => {
    it('includes anthropic-dangerous-direct-browser-access header in requests', async () => {
      const provider = new ClaudeProvider();

      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            content: [
              {
                text: JSON.stringify({
                  recommended: 'bugfix/PAY-123-fix-tax',
                  alternatives: ['bugfix/PAY-123-country-tax'],
                  reason: 'Fix tax logic.',
                }),
              },
            ],
            usage: { input_tokens: 50, output_tokens: 25 },
          }),
        });
      });

      const result = await provider.generateBranchName({
        issue: sampleIssue,
        config: DEFAULT_SETTINGS.naming,
        apiKey: 'sk-ant-fakekey',
        model: 'claude-3-5-haiku-20241022',
      });

      expect(capturedHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
      expect(capturedHeaders['x-api-key']).toBe('sk-ant-fakekey');
      expect(result.recommended).toBe('bugfix/pay-123-fix-tax');
    });
  });
});
