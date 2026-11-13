import { SettingsStorage } from '../storage/settingsStorage';
import { SafeLogger } from '../utils/logger';
import { BranchGenerator } from '../features/branch-generator/branchGenerator';
import {
  GENERATE_MESSAGE,
  GenerationJob,
  findUnseenJobForTab,
  getJob,
  saveJob,
} from '../features/branch-generator/generationJobs';
import { JiraIssue } from '../types/jira';

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

/**
 * Bring the popup back for a finished job the user hasn't seen, but only while its Jira
 * tab is the active tab. Unrelated sites never get a popup.
 */
async function reopenIfOnJobTab(job: GenerationJob) {
  if (job.seen || job.status === 'running' || job.tabId === undefined) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== job.tabId) return;
  const open = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.POPUP] });
  if (open.length > 0) return; // the open popup shows it and marks it seen
  // openPopup needs Chrome 127+ and a focused window; if it can't, the result still
  // waits in session storage and shows the next time the user clicks the icon.
  await chrome.action.openPopup({ windowId: tab.windowId }).catch(() => {});
}

async function runGeneration(issue: JiraIssue, tabId?: number) {
  const previous = await getJob(issue.key);
  await saveJob({ issueKey: issue.key, tabId, status: 'running', result: previous?.result, seen: true, updatedAt: Date.now() });

  // An MV3 worker idles out after ~30s without extension API calls; a slow model call
  // could cross that, so ping an API while the request is in flight.
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20_000);
  let job: GenerationJob;
  try {
    const result = await BranchGenerator.generate(issue);
    job = { issueKey: issue.key, tabId, status: 'done', result, seen: false, updatedAt: Date.now() };
  } catch (err) {
    job = {
      issueKey: issue.key,
      tabId,
      status: 'error',
      error: (err as Error)?.message || 'Branch generation failed.',
      result: previous?.result,
      seen: false,
      updatedAt: Date.now(),
    };
  } finally {
    clearInterval(keepAlive);
  }
  await saveJob(job);
  await reopenIfOnJobTab(job);
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const job = await findUnseenJobForTab(tabId);
  if (job) await reopenIfOnJobTab(job);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === GENERATE_MESSAGE && message.issue) {
    runGeneration(message.issue, message.tabId);
    sendResponse({ started: true });
    return false;
  }
  if (message?.type === 'FLASHX_PING') {
    sendResponse({ status: 'PONG', timestamp: Date.now() });
    return true;
  }
  return false;
});
