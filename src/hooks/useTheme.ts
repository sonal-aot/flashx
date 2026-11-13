import { useState, useEffect } from 'react';
import { SettingsStorage } from '../storage/settingsStorage';

export type Theme = 'dark' | 'light' | 'system';

// chrome.storage is async, so the saved theme would arrive after the first paint and
// flicker. A synchronous localStorage copy lets entry points apply it before rendering.
const CACHE_KEY = 'flashx_theme_cache';

const readCachedTheme = (): Theme => {
  try {
    return (localStorage.getItem(CACHE_KEY) as Theme) || 'system';
  } catch {
    return 'system';
  }
};

const cacheTheme = (t: Theme) => {
  try {
    localStorage.setItem(CACHE_KEY, t);
  } catch {
    // Storage unavailable: the async settings value still applies, just later.
  }
};

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(t: Theme) {
  const isDark = t === 'dark' || (t === 'system' && prefersDark());
  // Dark is the default token set; light overrides it via html.light.
  document.documentElement.classList.toggle('light', !isDark);
}

/** Call before the first render to avoid a theme flash. */
export const applyCachedTheme = () => applyTheme(readCachedTheme());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readCachedTheme);

  useEffect(() => {
    SettingsStorage.getSettings().then((s) => {
      const t = s.theme || 'system';
      setThemeState(t);
      cacheTheme(t);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    cacheTheme(newTheme);
    await SettingsStorage.updateSettings({ theme: newTheme });
  };

  return { theme, setTheme };
}
