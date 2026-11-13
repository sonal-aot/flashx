/**
 * Safe chrome.storage.local wrapper that works in Chrome Extension environment,
 * with graceful fallback to localStorage when running in standard browser/mock/test environments.
 */
export class ChromeStorageWrapper {
  private static isChromeStorageAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.storage &&
      !!chrome.storage.local
    );
  }

  static async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      if (this.isChromeStorageAvailable()) {
        const result = await chrome.storage.local.get(key);
        if (result && result[key] !== undefined) {
          return result[key] as T;
        }
        return defaultValue;
      }

      // Fallback to localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(`flashx_${key}`);
        if (item !== null) {
          try {
            return JSON.parse(item) as T;
          } catch {
            return item as unknown as T;
          }
        }
      }
      return defaultValue;
    } catch (err) {
      console.warn(`[FlashX Storage] Failed to get key "${key}":`, err);
      return defaultValue;
    }
  }

  static async set<T>(key: string, value: T): Promise<void> {
    try {
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`flashx_${key}`, JSON.stringify(value));
      }
    } catch (err) {
      console.error(`[FlashX Storage] Failed to set key "${key}":`, err);
      throw new Error(`Failed to persist storage item: ${key}`);
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.remove(key);
        return;
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`flashx_${key}`);
      }
    } catch (err) {
      console.error(`[FlashX Storage] Failed to remove key "${key}":`, err);
      throw new Error(`Failed to remove storage item: ${key}`);
    }
  }

  static async clear(): Promise<void> {
    try {
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.clear();
        return;
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith('flashx_')) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
      }
    } catch (err) {
      console.error('[FlashX Storage] Failed to clear storage:', err);
    }
  }
}
