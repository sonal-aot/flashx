import { JiraCloudAdapter } from '../features/jira/cloudAdapter';
import { JiraExtractResponse, JiraMessage } from '../types/jira';
import { SettingsStorage } from '../storage/settingsStorage';

// Instantiate Jira adapter
const jiraCloudAdapter = new JiraCloudAdapter();

let lastKnownUrl = window.location.href;
let lastKnownIssueKey: string | null = null;

/**
 * Extracts the issue with brief retries to handle dynamic SPA rendering
 */
async function extractCurrentIssueWithRetry(maxAttempts = 4, delayMs = 300) {
  const settings = await SettingsStorage.getSettings().catch(() => null);
  const customDomains = settings?.customJiraDomains || [];

  if (!jiraCloudAdapter.isMatch(window.location.href, customDomains)) {
    return {
      success: false,
      isJiraPage: false,
      error: 'Not a recognized Jira page.',
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const issue = await jiraCloudAdapter.extractIssue(document, window.location.href);

    // If key and a real title were found (not just placeholder), return it
    if (issue && issue.key && issue.title && !issue.title.startsWith('Issue ')) {
      return {
        success: true,
        isJiraPage: true,
        issue,
      };
    }

    // If key found but title might still be rendering, wait slightly
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Final attempt: return whatever was extracted (even if title is minimal)
  const finalIssue = await jiraCloudAdapter.extractIssue(document, window.location.href);
  if (finalIssue && finalIssue.key) {
    return {
      success: true,
      isJiraPage: true,
      issue: finalIssue,
    };
  }

  return {
    success: false,
    isJiraPage: true,
    isLoading: true,
    error: 'No active Jira ticket detected on this page.',
  };
}

/**
 * Checks for SPA URL transitions and notifies the extension
 */
async function checkNavigationChange() {
  const currentUrl = window.location.href;
  if (currentUrl === lastKnownUrl) return;

  lastKnownUrl = currentUrl;
  const result = await extractCurrentIssueWithRetry(2, 200);

  if (result.success && result.issue) {
    if (result.issue.key !== lastKnownIssueKey) {
      lastKnownIssueKey = result.issue.key;
      chrome.runtime.sendMessage<JiraMessage>({
        type: 'JIRA_ISSUE_CHANGED',
        payload: result.issue,
      }).catch(() => {
        // Popup or background might not be actively listening, ignore
      });
    }
  } else if (!result.issue) {
    lastKnownIssueKey = null;
    chrome.runtime.sendMessage<JiraMessage>({
      type: 'JIRA_ISSUE_CHANGED',
      payload: null,
    }).catch(() => {});
  }
}

// Intercept pushState & replaceState for immediate SPA navigation detection
const originalPushState = history.pushState;
history.pushState = function (...args) {
  originalPushState.apply(this, args);
  setTimeout(checkNavigationChange, 50);
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  setTimeout(checkNavigationChange, 50);
};

window.addEventListener('popstate', () => {
  setTimeout(checkNavigationChange, 50);
});

// Watch DOM title changes as a lightweight signal for SPA transitions
const titleObserver = new MutationObserver(() => {
  if (window.location.href !== lastKnownUrl) {
    checkNavigationChange();
  }
});

const titleEl = document.querySelector('title');
if (titleEl) {
  titleObserver.observe(titleEl, { childList: true });
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message: JiraMessage, _sender, sendResponse: (res: JiraExtractResponse) => void) => {
  if (message.type === 'PING') {
    sendResponse({ success: true, isJiraPage: true });
    return true;
  }

  if (message.type === 'GET_JIRA_ISSUE') {
    extractCurrentIssueWithRetry(4, 300).then((res) => {
      sendResponse(res);
    });
    return true; // Asynchronous sendResponse
  }

  return false;
});
