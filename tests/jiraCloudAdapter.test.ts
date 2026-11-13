import { describe, it, expect, beforeEach } from 'vitest';
import { JiraCloudAdapter } from '../src/features/jira/cloudAdapter';

describe('JiraCloudAdapter', () => {
  let adapter: JiraCloudAdapter;

  beforeEach(() => {
    adapter = new JiraCloudAdapter();
  });

  describe('isMatch', () => {
    it('matches standard Jira Cloud hostnames (*.atlassian.net)', () => {
      expect(adapter.isMatch('https://acme.atlassian.net/browse/PAY-123')).toBe(true);
      expect(adapter.isMatch('https://dev-team.atlassian.net/jira/your-work')).toBe(true);
    });

    it('matches custom configured Jira domains', () => {
      const customDomains = ['jira.mycorp.com', 'issues.internal.net'];
      expect(adapter.isMatch('https://jira.mycorp.com/browse/ENG-42', customDomains)).toBe(true);
      expect(adapter.isMatch('https://issues.internal.net/browse/ENG-42', customDomains)).toBe(true);
      expect(adapter.isMatch('https://other.com/browse/ENG-42', customDomains)).toBe(false);
    });

    it('rejects non-jira URLs', () => {
      expect(adapter.isMatch('https://github.com/facebook/react')).toBe(false);
      expect(adapter.isMatch('')).toBe(false);
    });
  });

  describe('extractIssue', () => {
    it('extracts issue key, title, type, and description from Jira Cloud DOM elements', async () => {
      const doc = document.implementation.createHTMLDocument('Jira Page');
      doc.body.innerHTML = `
        <div data-testid="issue.views.issue-base.foundation.summary.heading">
          Fix broken checkout redirect on Safari
        </div>
        <div data-testid="issue.views.issue-base.foundation.change-issue-type.button">
          Bug
        </div>
        <div data-testid="issue.views.field.rich-text.description">
          Users on iOS Safari get redirected to 404 after Stripe payment.
        </div>
        <div data-testid="issue.views.issue-base.foundation.status.status-field-wrapper">
          In Progress
        </div>
        <div data-testid="issue.views.issue-base.foundation.priority.priority-field-wrapper">
          High
        </div>
      `;

      const issue = await adapter.extractIssue(doc, 'https://test.atlassian.net/browse/STORE-501');

      expect(issue).not.toBeNull();
      expect(issue?.key).toBe('STORE-501');
      expect(issue?.projectKey).toBe('STORE');
      expect(issue?.title).toBe('Fix broken checkout redirect on Safari');
      expect(issue?.issueType).toBe('Bug');
      expect(issue?.description).toBe('Users on iOS Safari get redirected to 404 after Stripe payment.');
      expect(issue?.status).toBe('In Progress');
      expect(issue?.priority).toBe('High');
    });

    it('falls back to document title when DOM summary heading is absent', async () => {
      const doc = document.implementation.createHTMLDocument();
      doc.title = '[OPS-99] Provision production Redis cluster - Jira';
      doc.body.innerHTML = `
        <div data-testid="issue.views.issue-base.foundation.change-issue-type.button">
          Task
        </div>
      `;

      const issue = await adapter.extractIssue(doc, 'https://test.atlassian.net/browse/OPS-99');

      expect(issue).not.toBeNull();
      expect(issue?.key).toBe('OPS-99');
      expect(issue?.title).toBe('Provision production Redis cluster');
      expect(issue?.issueType).toBe('Task');
    });

    it('returns null if no issue key can be found in URL or DOM', async () => {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = '<div>Dashboard</div>';

      const issue = await adapter.extractIssue(doc, 'https://test.atlassian.net/jira/dashboards');
      expect(issue).toBeNull();
    });
  });
});
