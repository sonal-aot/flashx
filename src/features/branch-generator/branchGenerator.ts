import { JiraIssue } from '../../types/jira';
import { BranchGenerationResult } from '../../types/ai';
import { SettingsStorage } from '../../storage/settingsStorage';
import { credentialStorage } from '../../storage/credentialStorage';
import { HistoryStorage } from '../../storage/historyStorage';
import { ProviderFactory } from '../ai-providers/providerFactory';
import { FallbackGenerator } from './fallbackGenerator';
import { SafeLogger } from '../../utils/logger';

export class BranchGenerator {
  /**
   * Generates a branch name using the user's selected AI provider.
   * If the remote provider experiences temporary 503 high demand or 429 rate limits,
   * seamlessly falls back to the deterministic local rule engine so the developer is never blocked.
   */
  static async generate(issue: JiraIssue): Promise<BranchGenerationResult> {
    const settings = await SettingsStorage.getSettings();
    const providerId = settings.activeProvider;
    const provider = ProviderFactory.getProvider(providerId);

    const apiKey = await credentialStorage.getApiKey(providerId);

    if (!apiKey) {
      throw new Error(
        `No API key configured for ${provider.name}. Please enter your API key in FlashX settings.`
      );
    }

    const validation = await provider.validateConfiguration(apiKey);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid API key configuration.');
    }

    const selectedModel = settings.selectedModels[providerId] || provider.defaultModel;

    try {
      SafeLogger.info(`Generating branch with provider: ${providerId}, model: ${selectedModel}`);
      const result = await provider.generateBranchName({
        issue,
        config: settings.naming,
        apiKey,
        model: selectedModel,
      });

      // Save to local generation history
      await HistoryStorage.addHistory({
        issueKey: issue.key,
        issueTitle: issue.title,
        issueType: issue.issueType,
        branchName: result.recommended,
        alternatives: result.alternatives,
        reason: result.reason,
        provider: providerId,
        model: selectedModel,
      });

      return result;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      // If error is a 503 high demand spike, 429 rate limit, or service unavailable:
      if (
        msg.includes('503') ||
        msg.toLowerCase().includes('high demand') ||
        msg.toLowerCase().includes('high traffic') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('overloaded') ||
        msg.toLowerCase().includes('temporarily unavailable')
      ) {
        SafeLogger.info('AI provider unavailable. Generating with the local rule engine.');
        const fallbackResult = FallbackGenerator.generate(issue, settings.naming);
        const resultWithNotice: BranchGenerationResult = {
          ...fallbackResult,
          reason: `${fallbackResult.reason} (Generated locally because the AI provider was temporarily unavailable)`,
        };

        await HistoryStorage.addHistory({
          issueKey: issue.key,
          issueTitle: issue.title,
          issueType: issue.issueType,
          branchName: resultWithNotice.recommended,
          alternatives: resultWithNotice.alternatives,
          reason: resultWithNotice.reason,
          provider: providerId,
          model: 'offline-rule-fallback',
        });

        return resultWithNotice;
      }

      SafeLogger.warn('Remote AI generation failed:', err);
      throw err;
    }
  }

  /**
   * Local rule-based fallback generation without calling an external AI model
   */
  static async generateOfflineFallback(issue: JiraIssue): Promise<BranchGenerationResult> {
    const settings = await SettingsStorage.getSettings();
    const result = FallbackGenerator.generate(issue, settings.naming);

    await HistoryStorage.addHistory({
      issueKey: issue.key,
      issueTitle: issue.title,
      issueType: issue.issueType,
      branchName: result.recommended,
      alternatives: result.alternatives,
      reason: result.reason,
      provider: settings.activeProvider,
      model: 'offline-rule-engine',
    });

    return result;
  }
}
