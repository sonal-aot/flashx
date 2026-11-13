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

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Recommended)',
    description: 'Fast, highly capable, and extremely cost-efficient for branch generation.',
    isDefault: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Flagship omni model with highest reasoning fidelity.',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High-intelligence legacy model.',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Legacy fast model.',
  },
];

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly defaultModel = 'gpt-4o-mini';

  async getAvailableModels(): Promise<ModelInfo[]> {
    return OPENAI_MODELS;
  }

  async validateConfiguration(apiKey: string): Promise<ValidationResult> {
    const trimmed = apiKey ? apiKey.trim() : '';
    if (!trimmed) {
      return { isValid: false, error: 'OpenAI API key is required.' };
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
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with: {"status":"ok"}' }],
          response_format: { type: 'json_object' },
          max_tokens: 15,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const rawMessage = errJson?.error?.message || response.statusText;

        if (response.status === 401) {
          return {
            success: false,
            message: 'Invalid OpenAI API key. Please check your credentials.',
            errorDetails: rawMessage,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            message: 'OpenAI rate limit or usage quota exceeded.',
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
        message: 'Successfully connected to OpenAI API!',
        modelTested: model,
        latencyMs,
      };
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        success: false,
        message: isAbort ? 'Connection timed out (12s limit).' : 'Network error reaching OpenAI API.',
        errorDetails: (err as Error)?.message,
      };
    }
  }

  async generateBranchName(request: BranchGenerationRequest): Promise<BranchGenerationResult> {
    const { apiKey, model, config } = request;
    const { systemPrompt, userPrompt } = PromptBuilder.build(request);

    const activeModel = model || this.defaultModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your settings.');
        }
        if (response.status === 429) {
          throw new Error('OpenAI rate limit or credit balance exceeded. Please check your OpenAI account.');
        }
        throw new Error(`OpenAI API error (${response.status}): ${msg}`);
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;

      if (!rawText) {
        throw new Error('OpenAI returned an empty response.');
      }

      const validated = parseAndValidateAIResponse(rawText);

      const recommended = formatBranchName(validated.recommended, config);
      const alternatives = validated.alternatives.map((alt) => formatBranchName(alt, config));

      return {
        recommended,
        alternatives,
        reason: validated.reason,
        tokensUsed: data?.usage?.total_tokens,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      SafeLogger.error('OpenAI generation failed:', err);
      throw err;
    }
  }
}
