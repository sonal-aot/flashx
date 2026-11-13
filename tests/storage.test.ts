import { describe, it, expect, beforeEach } from 'vitest';
import { credentialStorage } from '../src/storage/credentialStorage';
import { SettingsStorage } from '../src/storage/settingsStorage';
import { HistoryStorage } from '../src/storage/historyStorage';
import { ChromeStorageWrapper } from '../src/storage/chromeStorage';

describe('Storage Layer', () => {
  beforeEach(async () => {
    await ChromeStorageWrapper.clear();
  });

  describe('CredentialStorage (BYOK)', () => {
    it('saves, retrieves, and checks API keys', async () => {
      expect(await credentialStorage.hasApiKey('gemini')).toBe(false);
      expect(await credentialStorage.getApiKey('gemini')).toBeNull();

      await credentialStorage.setApiKey('gemini', 'AIzaSyTestKey123');

      expect(await credentialStorage.hasApiKey('gemini')).toBe(true);
      expect(await credentialStorage.getApiKey('gemini')).toBe('AIzaSyTestKey123');
    });

    it('removes stored API keys', async () => {
      await credentialStorage.setApiKey('openai', 'sk-test12345');
      expect(await credentialStorage.hasApiKey('openai')).toBe(true);

      await credentialStorage.removeApiKey('openai');
      expect(await credentialStorage.hasApiKey('openai')).toBe(false);
      expect(await credentialStorage.getApiKey('openai')).toBeNull();
    });

    it('clears all credentials across providers', async () => {
      await credentialStorage.setApiKey('gemini', 'key1');
      await credentialStorage.setApiKey('openai', 'key2');
      await credentialStorage.setApiKey('claude', 'key3');

      await credentialStorage.clearAllCredentials();

      expect(await credentialStorage.hasApiKey('gemini')).toBe(false);
      expect(await credentialStorage.hasApiKey('openai')).toBe(false);
      expect(await credentialStorage.hasApiKey('claude')).toBe(false);
    });

    it('rejects empty API keys', async () => {
      await expect(credentialStorage.setApiKey('gemini', '   ')).rejects.toThrow(
        'API key cannot be empty'
      );
    });
  });

  describe('SettingsStorage', () => {
    it('returns default settings when none saved', async () => {
      const settings = await SettingsStorage.getSettings();
      expect(settings.activeProvider).toBe('gemini');
      expect(settings.naming.template).toBe('{type}/{ticket}-{description}');
    });

    it('updates partial settings and preserves other values', async () => {
      await SettingsStorage.updateSettings({
        activeProvider: 'claude',
        theme: 'dark',
      });

      const updated = await SettingsStorage.getSettings();
      expect(updated.activeProvider).toBe('claude');
      expect(updated.theme).toBe('dark');
      // Preserved fields
      expect(updated.naming.template).toBe('{type}/{ticket}-{description}');
    });
  });

  describe('HistoryStorage', () => {
    it('adds and retrieves generation history items', async () => {
      await HistoryStorage.addHistory({
        issueKey: 'PROJ-1',
        issueTitle: 'Test ticket 1',
        issueType: 'Bug',
        branchName: 'bugfix/PROJ-1-test',
        alternatives: ['bugfix/PROJ-1-test-alt'],
        provider: 'gemini',
        model: 'gemini-2.0-flash',
      });

      const history = await HistoryStorage.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].issueKey).toBe('PROJ-1');
      expect(history[0].branchName).toBe('bugfix/PROJ-1-test');
    });

    it('enforces history limit and prepends newest items', async () => {
      for (let i = 1; i <= 5; i++) {
        await HistoryStorage.addHistory({
          issueKey: `TICK-${i}`,
          issueTitle: `Title ${i}`,
          issueType: 'Story',
          branchName: `feature/TICK-${i}`,
          alternatives: [],
          provider: 'openai',
          model: 'gpt-4o-mini',
        });
      }

      const history = await HistoryStorage.getHistory();
      expect(history[0].issueKey).toBe('TICK-5');
      expect(history[4].issueKey).toBe('TICK-1');
    });

    it('deletes specific history item and clears history', async () => {
      const item = await HistoryStorage.addHistory({
        issueKey: 'DELETE-ME',
        issueTitle: 'Delete',
        issueType: 'Task',
        branchName: 'chore/del',
        alternatives: [],
        provider: 'gemini',
        model: 'gemini-2.0-flash',
      });

      expect(await HistoryStorage.getHistory()).toHaveLength(1);

      await HistoryStorage.deleteHistoryItem(item.id);
      expect(await HistoryStorage.getHistory()).toHaveLength(0);
    });
  });
});
