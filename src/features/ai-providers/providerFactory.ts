import { AIProvider, ProviderId } from '../../types/ai';
import { GeminiProvider } from './geminiProvider';
import { OpenAIProvider } from './openAiProvider';
import { ClaudeProvider } from './claudeProvider';

export class ProviderFactory {
  private static providers: Map<ProviderId, AIProvider> = new Map<ProviderId, AIProvider>([
    ['gemini', new GeminiProvider() as AIProvider],
    ['openai', new OpenAIProvider() as AIProvider],
    ['claude', new ClaudeProvider() as AIProvider],
  ]);

  static getProvider(id: ProviderId): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Unsupported AI provider: "${id}"`);
    }
    return provider;
  }

  static getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  static getAvailableProviderIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }
}
