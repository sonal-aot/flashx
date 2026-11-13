import {
  AIProvider,
  BranchGenerationRequest,
  BranchGenerationResult,
  ConnectionTestResult,
  ModelInfo,
  ValidationResult,
} from '../../types/ai';
import { PromptBuilder } from '../branch-generator/promptBuilder';
import { parseAndValidateAIResponse } from '../branch-generator/types';
import { formatBranchName } from '../../utils/branchFormatter';
import { SafeLogger } from '../../utils/logger';

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Recommended)',
    description: 'Fast, highly capable multimodal model for everyday engineering applications and agents.',
    isDefault: true,
    isFreeTier: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: 'High-speed, cost-efficient Flash model for rapid code synthesis.',
    isFreeTier: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Ultra-lightweight, high throughput Flash model.',
    isFreeTier: true,
  },
  {
    id: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    description: 'Frontier reasoning model for agentic coding and complex logic.',
    isFreeTier: false,
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Efficient frontier reasoning model.',
    isFreeTier: false,
  },
];

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-3.8-flash';

  async getAvailableModels(apiKey?: string): Promise<ModelInfo[]> {
    if (apiKey && apiKey.trim()) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.models)) {
            const fetched: ModelInfo[] = data.models
              .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes('generateContent')
              )
              .map((m: { name: string; displayName?: string; description?: string }) => {
                const id = m.name.replace(/^models\//, '');
                const isDefault = id === 'gemini-3.8-flash';
                const isFreeTier = id.includes('flash');
                return {
                  id,
                  name: m.displayName ? `${m.displayName} (${id})` : id,
                  description: m.description,
                  isDefault,
                  isFreeTier,
                };
              });
            if (fetched.length > 0) {
              return fetched;
            }
          }
        }
      } catch {
        // Fallback to static list
      }
    }
    return GEMINI_MODELS;
  }

  async validateConfiguration(apiKey: string, _model?: string): Promise<ValidationResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false, error: 'Google AI Studio API key is required.' };
    }
    if (!apiKey.startsWith('AIza')) {
      return {
        isValid: false,
        error: 'Key does not look like a Google AI Studio key (typically begins with "AIza").',
      };
    }
    return { isValid: true };
  }

  async testConnection(apiKey: string, model: string = this.defaultModel): Promise<ConnectionTestResult> {
    const start = Date.now();
    const trimmedKey = apiKey.trim();

    // 1. Fetch available models from Google AI Studio models.list endpoint
    let modelsFromApi: string[] = [];
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (listRes.ok) {
        const data = await listRes.json();
        if (Array.isArray(data?.models)) {
          modelsFromApi = data.models
            .filter((m: { supportedGenerationMethods?: string[] }) =>
              m.supportedGenerationMethods?.includes('generateContent')
            )
            .map((m: { name?: string }) => (m.name ? m.name.replace(/^models\//, '') : ''))
            .filter(Boolean);
        }
      } else if (listRes.status === 400 || listRes.status === 403) {
        const err = await listRes.json().catch(() => ({}));
        return {
          success: false,
          message: 'Invalid Google AI Studio API key or project permission denied.',
          errorDetails: err?.error?.message || listRes.statusText,
        };
      }
    } catch (listErr) {
      SafeLogger.warn('Could not list Gemini models from API, probing directly:', listErr);
    }

    // Determine candidate models to test
    let candidateModels: string[] = [];
    if (modelsFromApi.length > 0) {
      if (modelsFromApi.includes(model)) {
        candidateModels.push(model);
      }
      for (const pref of ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-4-carbon', 'gemini-4-argon']) {
        if (modelsFromApi.includes(pref) && !candidateModels.includes(pref)) {
          candidateModels.push(pref);
        }
      }
      for (const m of modelsFromApi) {
        if (!candidateModels.includes(m)) {
          candidateModels.push(m);
        }
      }
    } else {
      candidateModels = [
        model,
        ...(model !== 'gemini-3.8-flash' ? ['gemini-3.8-flash'] : []),
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-4-carbon',
        'gemini-4-argon',
      ];
    }

    let lastErrorDetails = '';

    for (const candidate of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(
          trimmedKey
        )}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Respond with: {"status":"ok"}' }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - start;

        if (response.ok) {
          const isFallback = candidate !== model;
          return {
            success: true,
            message: isFallback
              ? `Connected to Google Gemini! Switched to accessible model "${candidate}".`
              : `Successfully connected to Google Gemini (${candidate})!`,
            modelTested: candidate,
            latencyMs,
          };
        }

        const errorBody = await response.json().catch(() => ({}));
        lastErrorDetails = errorBody?.error?.message || response.statusText;

        // If unauthorized or permission denied, stop trying other models (key issue)
        if (response.status === 400 || response.status === 403) {
          return {
            success: false,
            message: 'Invalid Google AI Studio API key or project permission denied.',
            errorDetails: lastErrorDetails,
          };
        }

        // If 404 (model not provisioned for this key), try the next candidate model
        if (response.status === 404) {
          continue;
        }

        if (response.status === 429) {
          return {
            success: false,
            message: 'Gemini API rate limit reached. Please wait a moment.',
            errorDetails: lastErrorDetails,
          };
        }

        return {
          success: false,
          message: `Connection failed with status ${response.status}`,
          errorDetails: lastErrorDetails,
        };
      } catch (err: unknown) {
        const isAbort = (err as Error)?.name === 'AbortError';
        if (isAbort) {
          return {
            success: false,
            message: 'Connection timed out (10s limit).',
            errorDetails: (err as Error)?.message,
          };
        }
      }
    }

    return {
      success: false,
      message: `Model "${model}" not found or not accessible on this key. Please select an active model (e.g. gemini-3.8-flash).`,
      errorDetails: lastErrorDetails,
    };
  }

  async generateBranchName(request: BranchGenerationRequest): Promise<BranchGenerationResult> {
    const { apiKey, model, config } = request;
    const { systemPrompt, userPrompt } = PromptBuilder.build(request);

    let activeModel = model || this.defaultModel;

    const executeCall = async (modelToUse: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        return response;
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    };

    try {
      let response = await executeCall(activeModel);

      // If model not found (404) and was not already gemini-3.8-flash, fallback to gemini-3.8-flash
      if (response.status === 404 && activeModel !== 'gemini-3.8-flash') {
        SafeLogger.warn(`Model ${activeModel} returned 404. Falling back to gemini-3.8-flash.`);
        activeModel = 'gemini-3.8-flash';
        response = await executeCall(activeModel);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        if (response.status === 429) {
          throw new Error('Gemini API rate limit reached. Try again in a few moments.');
        }
        if (response.status === 400 || response.status === 403) {
          throw new Error('Invalid Google AI Studio API key or unauthorized access.');
        }
        if (response.status === 404) {
          throw new Error(`Gemini model "${activeModel}" not found or not accessible on this key. Please choose gemini-3.8-flash in Settings.`);
        }
        throw new Error(`Gemini API error (${response.status}): ${msg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini returned an empty candidate response.');
      }

      const validated = parseAndValidateAIResponse(rawText);

      // Sanitize all branch names locally to strictly enforce Git specifications and user casing
      const recommended = formatBranchName(validated.recommended, config);
      const alternatives = validated.alternatives.map((alt) => formatBranchName(alt, config));

      return {
        recommended,
        alternatives,
        reason: validated.reason,
        tokensUsed: data?.usageMetadata?.totalTokenCount,
      };
    } catch (err: unknown) {
      SafeLogger.error('Gemini generation failed:', err);
      throw err;
    }
  }
}
