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
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (Recommended - Free Tier)',
    description: 'Fast, reliable, free-tier eligible model accessible to all Google AI Studio keys.',
    isDefault: true,
    isFreeTier: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Next-gen Flash model with high reasoning speed (subject to project availability).',
    isFreeTier: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Ultra-lightweight, high throughput Flash model.',
    isFreeTier: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'High-reasoning model for complex code and architecture.',
    isFreeTier: false,
  },
];

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-1.5-flash';

  async getAvailableModels(): Promise<ModelInfo[]> {
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
    const candidateModels = [
      model,
      ...(model !== 'gemini-1.5-flash' ? ['gemini-1.5-flash'] : []),
      ...(model !== 'gemini-2.0-flash' ? ['gemini-2.0-flash'] : []),
      'gemini-1.5-flash-latest',
    ];

    let lastErrorDetails = '';

    for (const candidate of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(
          apiKey.trim()
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
      message: `Model "${model}" not found or not accessible on this key. Please select a model enabled for your project (e.g. gemini-1.5-flash).`,
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

      // If model not found (404) and was not already gemini-1.5-flash, fallback to gemini-1.5-flash
      if (response.status === 404 && activeModel !== 'gemini-1.5-flash') {
        SafeLogger.warn(`Model ${activeModel} returned 404. Falling back to gemini-1.5-flash.`);
        activeModel = 'gemini-1.5-flash';
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
          throw new Error(`Gemini model "${activeModel}" not found or not accessible on this key. Please choose gemini-1.5-flash in Settings.`);
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
