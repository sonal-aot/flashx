import { SettingsStorage } from '../storage/settingsStorage';
import { SafeLogger } from '../utils/logger';

chrome.runtime.onInstalled.addListener(async (details) => {
  SafeLogger.info('FlashX extension installed or updated:', details.reason);

  try {
    const settings = await SettingsStorage.getSettings();

    // If fresh install, ensure defaults are written
    if (details.reason === 'install') {
      await SettingsStorage.saveSettings(settings);
      SafeLogger.info('FlashX initialized with default settings.');
    }
  } catch (err) {
    SafeLogger.error('Failed to initialize FlashX storage on install:', err);
  }
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FLASHX_PING') {
    sendResponse({ status: 'PONG', timestamp: Date.now() });
    return true;
  }
  return false;
});
