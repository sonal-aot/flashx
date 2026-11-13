import { HistoryItem } from '../types/settings';
import { ChromeStorageWrapper } from './chromeStorage';
import { SettingsStorage } from './settingsStorage';

const HISTORY_KEY = 'generation_history_v1';

export class HistoryStorage {
  static async getHistory(): Promise<HistoryItem[]> {
    const history = await ChromeStorageWrapper.get<HistoryItem[]>(HISTORY_KEY, []);
    return Array.isArray(history) ? history : [];
  }

  static async addHistory(
    item: Omit<HistoryItem, 'id' | 'timestamp'>
  ): Promise<HistoryItem> {
    const settings = await SettingsStorage.getSettings();
    const current = await this.getHistory();

    const newItem: HistoryItem = {
      ...item,
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    // Filter out duplicates of same branch if generated within last minute, then prepend
    const filtered = current.filter(
      (h) => !(h.issueKey === item.issueKey && h.branchName === item.branchName)
    );

    const limit = settings.historyLimit || 50;
    const updated = [newItem, ...filtered].slice(0, limit);

    await ChromeStorageWrapper.set(HISTORY_KEY, updated);
    return newItem;
  }

  static async deleteHistoryItem(id: string): Promise<void> {
    const current = await this.getHistory();
    const updated = current.filter((h) => h.id !== id);
    await ChromeStorageWrapper.set(HISTORY_KEY, updated);
  }

  static async clearHistory(): Promise<void> {
    await ChromeStorageWrapper.remove(HISTORY_KEY);
  }
}
