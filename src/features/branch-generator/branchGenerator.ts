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
   * If credentials are missing or the user chooses offline mode, falls back gracefully.
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
      SafeLogger.error('AI branch generation failed:', err);
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
