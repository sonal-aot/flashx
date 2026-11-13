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

const CLAUDE_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku (Recommended)',
    description: 'Ultra-fast, brilliant reasoning at lower cost.',
    isDefault: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Premier coding and complex reasoning model.',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'High depth analysis for large architectures.',
  },
];

export class ClaudeProvider implements AIProvider {
  readonly id = 'claude';
  readonly name = 'Anthropic Claude';
  readonly defaultModel = 'claude-3-5-haiku-20241022';

  async getAvailableModels(): Promise<ModelInfo[]> {
    return CLAUDE_MODELS;
  }

  async validateConfiguration(apiKey: string): Promise<ValidationResult> {
    const trimmed = apiKey ? apiKey.trim() : '';
    if (!trimmed) {
      return { isValid: false, error: 'Anthropic Claude API key is required.' };
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 20,
          messages: [{ role: 'user', content: 'Respond with: {"status":"ok"}' }],
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
            message: 'Invalid Anthropic API key. Please check your credentials.',
            errorDetails: rawMessage,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            message: 'Anthropic rate limit or credit balance exceeded.',
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
        message: 'Successfully connected to Anthropic Claude!',
        modelTested: model,
        latencyMs,
      };
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        success: false,
        message: isAbort ? 'Connection timed out (12s limit).' : 'Network error reaching Anthropic API.',
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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: activeModel,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        if (response.status === 401) {
          throw new Error('Invalid Anthropic API key. Please check your settings.');
        }
        if (response.status === 429) {
          throw new Error('Claude rate limit or credit balance exceeded. Please check your Anthropic account.');
        }
        throw new Error(`Claude API error (${response.status}): ${msg}`);
      }

      const data = await response.json();
      const rawText = data?.content?.[0]?.text;

      if (!rawText) {
        throw new Error('Claude returned an empty response.');
      }

      const validated = parseAndValidateAIResponse(rawText);

      const recommended = formatBranchName(validated.recommended, config);
      const alternatives = validated.alternatives.map((alt) => formatBranchName(alt, config));

      return {
        recommended,
        alternatives,
        reason: validated.reason,
        tokensUsed: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      SafeLogger.error('Claude generation failed:', err);
      throw err;
    }
  }
}
