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
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Recommended)',
    description: 'Fastest, highly capable multimodal model with free tier available.',
    isDefault: true,
    isFreeTier: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Ultra lightweight, cost-effective for high volume requests.',
    isFreeTier: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Balanced speed and accuracy for everyday coding tasks.',
    isFreeTier: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'High-reasoning model for complex architecture and edge cases.',
    isFreeTier: false,
  },
];

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-2.0-flash';

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
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

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

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const rawMessage = errorBody?.error?.message || response.statusText;

        if (response.status === 400 || response.status === 403) {
          return {
            success: false,
            message: 'Invalid Google AI Studio API key or project permission denied.',
            errorDetails: rawMessage,
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            message: `Model "${model}" not found or not accessible on this key.`,
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
      }

      return {
        success: true,
        message: 'Successfully connected to Google Gemini!',
        modelTested: model,
        latencyMs,
      };
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        success: false,
        message: isAbort ? 'Connection timed out (12s limit).' : 'Network error reaching Google Gemini API.',
        errorDetails: (err as Error)?.message,
      };
    }
  }

  async generateBranchName(request: BranchGenerationRequest): Promise<BranchGenerationResult> {
    const { apiKey, model, config } = request;
    const { systemPrompt, userPrompt } = PromptBuilder.build(request);

    const activeModel = model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        if (response.status === 429) {
          throw new Error('Gemini API rate limit reached. Try again in a few moments.');
        }
        if (response.status === 400 || response.status === 403) {
          throw new Error('Invalid Google AI Studio API key or unauthorized access.');
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
      clearTimeout(timeout);
      SafeLogger.error('Gemini generation failed:', err);
      throw err;
    }
  }
}
