import '@testing-library/jest-dom';

// In-memory mock for chrome.storage.local
const storageState: Record<string, unknown> = {};

export const mockStorageLocal = {
  get: (keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
    return new Promise((resolve) => {
      if (!keys) {
        resolve({ ...storageState });
        return;
      }
      if (typeof keys === 'string') {
        resolve({ [keys]: storageState[keys] });
        return;
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in storageState) {
            result[k] = storageState[k];
          }
        }
        resolve(result);
        return;
      }
      if (typeof keys === 'object') {
        const result: Record<string, unknown> = { ...keys };
        for (const k of Object.keys(keys)) {
          if (k in storageState) {
            result[k] = storageState[k];
          }
        }
        resolve(result);
        return;
      }
      resolve({});
    });
  },
  set: (items: Record<string, unknown>): Promise<void> => {
    return new Promise((resolve) => {
      Object.assign(storageState, items);
      resolve();
    });
  },
  remove: (keys: string | string[]): Promise<void> => {
    return new Promise((resolve) => {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      for (const k of keysToRemove) {
        delete storageState[k];
      }
      resolve();
    });
  },
  clear: (): Promise<void> => {
    return new Promise((resolve) => {
      for (const k of Object.keys(storageState)) {
        delete storageState[k];
      }
      resolve();
    });
  },
  _dump: () => ({ ...storageState }),
};

// Mock chrome global
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: mockStorageLocal,
  },
  tabs: {
    query: async () => [{ id: 1, url: 'https://test.atlassian.net/browse/PROJ-123' }],
    sendMessage: async () => ({
      success: true,
      issue: {
        key: 'PROJ-123',
        title: 'Fix international tax calculation',
        description: 'Update calculation logic for international orders.',
        issueType: 'Bug',
        projectKey: 'PROJ',
        url: 'https://test.atlassian.net/browse/PROJ-123',
        detectedAt: Date.now(),
      },
    }),
  },
  runtime: {
    sendMessage: async () => ({ success: true }),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    openOptionsPage: () => {},
  },
};

// Mock clipboard
if (!navigator.clipboard) {
  let clipboardText = '';
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: async (text: string) => {
        clipboardText = text;
      },
      readText: async () => clipboardText,
    },
    writable: true,
    configurable: true,
  });
}
