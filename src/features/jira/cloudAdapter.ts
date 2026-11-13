import { JiraIssue } from '../../types/jira';
import { JiraAdapter, JiraAdapterRegistry } from './adapter';
import { JiraParser } from './parser';

export class JiraCloudAdapter implements JiraAdapter {
  readonly id = 'jira-cloud';
  readonly name = 'Jira Cloud Adapter';

  isMatch(url: string, customDomains: string[] = []): boolean {
    if (!url) return false;

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // Check standard Jira Cloud domain: *.atlassian.net
      if (hostname.endsWith('.atlassian.net')) {
        return true;
      }

      // Check any user-defined custom Jira domains
      for (const domain of customDomains) {
        const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '');
        if (cleanDomain && (hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`))) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  async extractIssue(doc?: Document, currentUrl?: string): Promise<JiraIssue | null> {
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
    const url = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');

    if (!targetDoc) return null;

    // 1. Extract Issue Key
    let key = JiraParser.extractIssueKey(url);

    if (!key) {
      // Try DOM breadcrumbs / key elements
      const keySelectors = [
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]',
        '#key-val',
        'a[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]',
      ];
      for (const sel of keySelectors) {
        const el = targetDoc.querySelector(sel);
        if (el?.textContent) {
          const extracted = JiraParser.extractIssueKey(el.textContent);
          if (extracted) {
            key = extracted;
            break;
          }
        }
      }
    }

    // Fallback: document.title for key
    if (!key && targetDoc.title) {
      const parsedTitle = JiraParser.parseDocumentTitle(targetDoc.title);
      if (parsedTitle.key) {
        key = parsedTitle.key;
      }
    }

    if (!key) {
      return null;
    }

    const projectKey = JiraParser.extractProjectKey(key);

    // 2. Extract Title / Summary
    let title = '';
    const titleSelectors = [
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
      'h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
      '[data-component-selector="jira-issue-view-issue-title"]',
      '[data-testid="issue-field-summary.ui.issue-field-summary-inline-edit--container"] textarea',
      '#summary-val',
    ];

    for (const sel of titleSelectors) {
      const el = targetDoc.querySelector(sel);
      if (el) {
        const text = (el as HTMLTextAreaElement).value || el.textContent || '';
        if (text.trim()) {
          title = text.trim();
          break;
        }
      }
    }

    // Fallback title from document.title
    if (!title && targetDoc.title) {
      const parsed = JiraParser.parseDocumentTitle(targetDoc.title);
      if (parsed.title) {
        title = parsed.title;
      }
    }

    if (!title) {
      // Try first main H1 in page
      const h1 = targetDoc.querySelector('main h1, [role="main"] h1');
      if (h1?.textContent?.trim()) {
        title = h1.textContent.trim();
      }
    }

    // 3. Extract Issue Type
    let issueType = 'Story';
    const typeSelectors = [
      '[data-testid="issue.views.issue-base.foundation.change-issue-type.button"]',
      '[data-testid="issue-field-issuetype.ui.issue-type-name"]',
      '[data-test-id="issue.views.issue-base.foundation.change-issue-type.button"]',
      '#type-val',
    ];

    for (const sel of typeSelectors) {
      const el = targetDoc.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length < 30) {
          issueType = text;
          break;
        }
        // Check image alt attribute
        const img = el.querySelector('img[alt]');
        if (img?.getAttribute('alt')) {
          issueType = img.getAttribute('alt') || issueType;
          break;
        }
      }
    }

    // 4. Extract Description
    let rawDescription = '';
    const descSelectors = [
      '[data-testid="issue.views.field.rich-text.description"]',
      '[data-component-selector="jira-issue-view-rich-text-inline-edit-view-container"]',
      '[data-testid="issue.views.issue-base.foundation.description.description-field"]',
      '#description-val',
      '[data-testid="issue.views.field.rich-text.description"] .ak-renderer-document',
    ];

    for (const sel of descSelectors) {
      const el = targetDoc.querySelector(sel);
      if (el?.textContent?.trim()) {
        rawDescription = el.textContent;
        break;
      }
    }

    const description = JiraParser.sanitizeDescription(rawDescription);

    // 5. Extract Status & Priority (optional context)
    const statusEl = targetDoc.querySelector(
      '[data-testid="issue.views.issue-base.foundation.status.status-field-wrapper"], #status-val'
    );
    const status = statusEl?.textContent?.trim() || undefined;

    const priorityEl = targetDoc.querySelector(
      '[data-testid="issue.views.issue-base.foundation.priority.priority-field-wrapper"], #priority-val'
    );
    const priority = priorityEl?.textContent?.trim() || undefined;

    return {
      key,
      title: title || `Issue ${key}`,
      description,
      issueType,
      projectKey,
      url,
      status,
      priority,
      detectedAt: Date.now(),
    };
  }
}

// Auto-register default Jira Cloud Adapter
JiraAdapterRegistry.register(new JiraCloudAdapter());
