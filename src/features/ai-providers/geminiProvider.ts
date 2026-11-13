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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);

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
    const trimmed = apiKey ? apiKey.trim() : '';
    if (!trimmed) {
      return { isValid: false, error: 'Google AI Studio API key is required.' };
    }
    if (trimmed.length < 5) {
      return {
        isValid: false,
        error: 'API key is too short. Please verify your credentials.',
      };
    }
    return { isValid: true };
  }

  async testConnection(apiKey: string, model: string = this.defaultModel): Promise<ConnectionTestResult> {
    const start = Date.now();
    const trimmedKey = apiKey.trim();

    // Fast, lightweight verification via GET /v1beta/models/${model} (responds in ~200ms without heavy LLM inference)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(trimmedKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return {
          success: true,
          message: `Successfully connected to Google Gemini (${model})!`,
          modelTested: model,
          latencyMs,
        };
      }

      const errorBody = await response.json().catch(() => ({}));
      const rawMessage = errorBody?.error?.message || response.statusText;

      // If unauthorized or permission denied, stop immediately
      if (response.status === 400 || response.status === 403) {
        return {
          success: false,
          message: 'Invalid Google AI Studio API key or project permission denied.',
          errorDetails: rawMessage,
        };
      }

      // If 404 (model not found on this project), query available models list
      if (response.status === 404) {
        try {
          const listController = new AbortController();
          const listTimer = setTimeout(() => listController.abort(), 6000);
          const listRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`,
            { signal: listController.signal }
          );
          clearTimeout(listTimer);

          if (listRes.ok) {
            const data = await listRes.json().catch(() => ({}));
            const available = (data?.models || [])
              .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes('generateContent')
              )
              .map((m: { name?: string }) => (m.name ? m.name.replace(/^models\//, '') : ''))
              .filter(Boolean);

            const alt = available.find((m: string) => m.includes('flash')) || available[0];
            if (alt) {
              return {
                success: true,
                message: `Connected! Model "${model}" was not accessible; switched to accessible model "${alt}".`,
                modelTested: alt,
                latencyMs: Date.now() - start,
              };
            }
          }
        } catch {
          // Ignore list error and report model not found
        }

        return {
          success: false,
          message: `Model "${model}" not found or not accessible on this key. Please select a model enabled for your project.`,
          errorDetails: rawMessage,
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          message: 'Gemini API rate limit reached. Please wait a moment.',
          errorDetails: rawMessage,
        };
      }

      return {
        success: false,
        message: `Connection failed with status ${response.status}`,
        errorDetails: rawMessage,
      };
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        success: false,
        message: isAbort ? 'Connection timed out (15s limit). Please check your internet connection.' : 'Network error reaching Google Gemini API.',
        errorDetails: (err as Error)?.message,
      };
    }
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
      const timeout = setTimeout(() => controller.abort(), 30000); // Generous 30s timeout for LLM inference

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
              maxOutputTokens: 512,
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
