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
        model: 'gemini-2.0-flash',
      });

      expect(result.recommended).toBe('bugfix/pay-123-fix-international-tax');
      expect(result.alternatives).toHaveLength(2);
      expect(result.tokensUsed).toBe(120);
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
          model: 'gemini-2.0-flash',
        })
      ).rejects.toThrow('Gemini API rate limit reached');
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

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        // First call with gemini-2.0-flash returns 404
        if (url.includes('gemini-2.0-flash:generateContent')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({ error: { message: 'models/gemini-2.0-flash is not found for API version v1beta' } }),
          });
        }
        // Fallback call with gemini-1.5-flash succeeds
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });
      });

      const res = await provider.testConnection('AIzaSyValidKey', 'gemini-2.0-flash');
      expect(res.success).toBe(true);
      expect(res.modelTested).toBe('gemini-1.5-flash');
      expect(res.message).toContain('Switched to accessible model "gemini-1.5-flash"');
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
