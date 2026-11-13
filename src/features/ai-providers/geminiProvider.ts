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

// Synced with https://aistudio.google.com/docs/models and /docs/pricing (Nov 2026).
// Free-tier models first; Carbon and Argon are not available on the free tier.
const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Recommended)',
    description: 'Fast, highly capable model for everyday engineering tasks.',
    isDefault: true,
    isFreeTier: true,
  },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', isFreeTier: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', isFreeTier: true },
  { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', isFreeTier: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', isFreeTier: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', isFreeTier: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', isFreeTier: true },
  { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', isFreeTier: false },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', isFreeTier: false },
];

const FREE_TIER_IDS = new Set(GEMINI_MODELS.filter((m) => m.isFreeTier).map((m) => m.id));

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
                const isFreeTier = FREE_TIER_IDS.has(id);
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

      if (response.status === 400 || response.status === 403) {
        return {
          success: false,
          message: 'Invalid Google AI Studio API key or project permission denied.',
          errorDetails: rawMessage,
        };
      }

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
          // Ignore list error
        }

        return {
          success: false,
          message: `Model "${model}" not found or not accessible on this key. Please select a model enabled for your project.`,
          errorDetails: rawMessage,
        };
      }

      if (response.status === 503) {
        return {
          success: true,
          message: `Connected to Google Gemini API! Note: "${model}" is currently experiencing temporary high traffic.`,
          modelTested: model,
          latencyMs,
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

    const activeModel = model || this.defaultModel;

    // Failover candidate models if the chosen model experiences 503 high demand or 429 spikes
    const candidateModels = [
      activeModel,
      ...(activeModel !== 'gemini-3.6-flash' ? ['gemini-3.6-flash'] : []),
      ...(activeModel !== 'gemini-3.5-flash-lite' ? ['gemini-3.5-flash-lite'] : []),
      ...(activeModel !== 'gemini-3.8-flash' ? ['gemini-3.8-flash'] : []),
    ];

    // Gemini 3+ models think at medium/high by default, which is most of the latency
    // for a one-line answer. LOW is supported by every 3.x/4 model ("minimal" isn't on
    // 3.8/4). Gemini 2.x rejects thinkingLevel, and 2.5 Flash-Lite doesn't think anyway.
    const thinkingConfigFor = (m: string) => (/^gemini-2\./.test(m) ? undefined : { thinkingLevel: 'LOW' });

    const executeCall = async (modelToUse: string, withThinkingConfig = true) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

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
              ...(withThinkingConfig && thinkingConfigFor(modelToUse)
                ? { thinkingConfig: thinkingConfigFor(modelToUse) }
                : {}),
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

    let lastErrorMsg = '';

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      try {
        const started = Date.now();
        let response = await executeCall(currentModel);

        // If this model rejects the thinking setting, retry once without it
        // instead of surfacing the 400 as an API key problem.
        if (response.status === 400) {
          const body = await response.clone().json().catch(() => ({}));
          if (/thinking/i.test(body?.error?.message ?? '')) {
            response = await executeCall(currentModel, false);
          }
        }

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!rawText) {
            throw new Error('Gemini returned an empty candidate response.');
          }

          SafeLogger.info(
            `Gemini ${currentModel} responded in ${Date.now() - started}ms ` +
              `(thinking tokens: ${data?.usageMetadata?.thoughtsTokenCount ?? 0})`
          );

          const validated = parseAndValidateAIResponse(rawText);

          const recommended = formatBranchName(validated.recommended, config);
          const alternatives = validated.alternatives.map((alt) => formatBranchName(alt, config));

          const reasonText =
            currentModel !== activeModel
              ? `${validated.reason} (Synthesized via ${currentModel} due to high traffic on ${activeModel})`
              : validated.reason;

          return {
            recommended,
            alternatives,
            reason: reasonText,
            tokensUsed: data?.usageMetadata?.totalTokenCount,
          };
        }

        const errorData = await response.json().catch(() => ({}));
        lastErrorMsg = errorData?.error?.message || response.statusText;

        // If key unauthorized, fail immediately
        if (response.status === 400 || response.status === 403) {
          throw new Error('Invalid Google AI Studio API key or unauthorized project access.');
        }

        // A 503 or 429 is usually project-wide, so another model request adds noise without helping.
        if (response.status === 503) {
          throw new Error('Google Gemini is temporarily unavailable (503).');
        }
        if (response.status === 429) {
          throw new Error('Gemini API rate limit reached. Try again in a few moments.');
        }

        if (response.status === 404) {
          if (i < candidateModels.length - 1) {
            continue;
          }
        }

        throw new Error(`Gemini API error (${response.status}): ${lastErrorMsg}`);
      } catch (err: unknown) {
        if (
          (err as Error)?.message?.includes('Invalid Google AI Studio API key') ||
          (err as Error)?.message?.includes('temporarily unavailable') ||
          (err as Error)?.message?.includes('rate limit reached')
        ) {
          throw err;
        }

        // Continue to next candidate model if available
        if (i < candidateModels.length - 1) {
          SafeLogger.info(`Request failed on ${currentModel}. Trying the next available model.`);
          continue;
        }

        SafeLogger.error('Gemini generation failed:', err);
        throw err;
      }
    }

    throw new Error(
      lastErrorMsg ||
        'Gemini models are currently experiencing temporary high traffic. Please try again or use Offline Mode.'
    );
  }
}
