import { FlashXSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../features/settings/defaultSettings';
import { ChromeStorageWrapper } from './chromeStorage';

const SETTINGS_KEY = 'settings_v1';

export class SettingsStorage {
  static async getSettings(): Promise<FlashXSettings> {
    const stored = await ChromeStorageWrapper.get<Partial<FlashXSettings> | null>(SETTINGS_KEY, null);
    if (!stored) {
      return { ...DEFAULT_SETTINGS };
    }

    // Merge stored settings with defaults to ensure all fields exist (graceful migration)
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      naming: {
        ...DEFAULT_SETTINGS.naming,
        ...(stored.naming || {}),
      },
      selectedModels: {
        ...DEFAULT_SETTINGS.selectedModels,
        ...(stored.selectedModels || {}),
      },
      customJiraDomains: Array.isArray(stored.customJiraDomains)
        ? stored.customJiraDomains
        : DEFAULT_SETTINGS.customJiraDomains,
    };
  }

  static async saveSettings(settings: FlashXSettings): Promise<void> {
    await ChromeStorageWrapper.set(SETTINGS_KEY, settings);
  }

  static async updateSettings(partial: Partial<FlashXSettings>): Promise<FlashXSettings> {
    const current = await this.getSettings();
    const updated: FlashXSettings = {
      ...current,
      ...partial,
      naming: partial.naming ? { ...current.naming, ...partial.naming } : current.naming,
      selectedModels: partial.selectedModels
        ? { ...current.selectedModels, ...partial.selectedModels }
        : current.selectedModels,
    };
    await this.saveSettings(updated);
    return updated;
  }

  static async resetSettings(): Promise<FlashXSettings> {
    await this.saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}
