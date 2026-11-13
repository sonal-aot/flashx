import { ProviderId } from '../types/ai';
import { ChromeStorageWrapper } from './chromeStorage';

/**
 * Credential storage abstraction for BYOK (Bring Your Own Key) architecture.
 *
 * Security Guarantees:
 * 1. Stored exclusively in local browser extension storage (chrome.storage.local).
 * 2. NEVER stored in chrome.storage.sync (preventing automatic cloud sync).
 * 3. NEVER sent to FlashX or any 3rd party backend; requests travel directly from browser to provider API.
 * 4. API keys are never written to logs or error messages.
 * 5. Can be completely deleted at any time by the user.
 *
 * Limitations Notice:
 * Chrome local storage is sandboxed to the extension origin, but not hardware-encrypted
 * at rest with user-derived keys. Physical access or root/malware access to the host machine
 * could inspect browser profile directories.
 */
export interface ICredentialStorage {
  getApiKey(provider: ProviderId): Promise<string | null>;
  setApiKey(provider: ProviderId, apiKey: string): Promise<void>;
  removeApiKey(provider: ProviderId): Promise<void>;
  hasApiKey(provider: ProviderId): Promise<boolean>;
  clearAllCredentials(): Promise<void>;
}

export class LocalCredentialStorage implements ICredentialStorage {
  private static readonly KEY_PREFIX = 'byok_key_';

  private getStorageKey(provider: ProviderId): string {
    return `${LocalCredentialStorage.KEY_PREFIX}${provider}`;
  }

  async getApiKey(provider: ProviderId): Promise<string | null> {
    try {
      const key = this.getStorageKey(provider);
      const value = await ChromeStorageWrapper.get<string | null>(key, null);
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return null;
      }
      return value.trim();
    } catch {
      // Intentionally do not log error details that might contain context
      return null;
    }
  }

  async setApiKey(provider: ProviderId, apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new Error('API key cannot be empty.');
    }
    const key = this.getStorageKey(provider);
    await ChromeStorageWrapper.set(key, trimmed);
  }

  async removeApiKey(provider: ProviderId): Promise<void> {
    const key = this.getStorageKey(provider);
    await ChromeStorageWrapper.remove(key);
  }

  async hasApiKey(provider: ProviderId): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return !!key && key.length > 0;
  }

  async clearAllCredentials(): Promise<void> {
    const providers: ProviderId[] = ['gemini', 'openai', 'claude'];
    for (const p of providers) {
      await this.removeApiKey(p);
    }
  }
}

export const credentialStorage = new LocalCredentialStorage();
