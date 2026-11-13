import { describe, it, expect } from 'vitest';
import { JiraParser } from '../src/features/jira/parser';

describe('JiraParser', () => {
  describe('extractIssueKey', () => {
    it('extracts key from standard browse URL', () => {
      const url = 'https://myorg.atlassian.net/browse/PROJ-123';
      expect(JiraParser.extractIssueKey(url)).toBe('PROJ-123');
    });

    it('extracts key from browse URL with subpaths or anchors', () => {
      const url = 'https://myorg.atlassian.net/browse/FRONT-4567#comment-890';
      expect(JiraParser.extractIssueKey(url)).toBe('FRONT-4567');
    });

    it('extracts key from selectedIssue query parameter in board views', () => {
      const url = 'https://company.atlassian.net/jira/software/projects/CORE/boards/1?selectedIssue=CORE-987';
      expect(JiraParser.extractIssueKey(url)).toBe('CORE-987');
    });

    it('extracts key from plain text with lowercase input and normalizes to uppercase', () => {
      expect(JiraParser.extractIssueKey('pay-442')).toBe('PAY-442');
    });

    it('returns null for non-jira text or invalid keys', () => {
      expect(JiraParser.extractIssueKey('https://google.com')).toBeNull();
      expect(JiraParser.extractIssueKey('')).toBeNull();
      expect(JiraParser.extractIssueKey('PROJECT_123')).toBeNull();
    });
  });

  describe('extractProjectKey', () => {
    it('extracts project key prefix', () => {
      expect(JiraParser.extractProjectKey('PAY-123')).toBe('PAY');
      expect(JiraParser.extractProjectKey('CORE2-99')).toBe('CORE2');
    });
  });

  describe('parseDocumentTitle', () => {
    it('parses Jira document title with bracketed key', () => {
      const title = '[PAY-123] Fix international tax calculation - Jira';
      const parsed = JiraParser.parseDocumentTitle(title);
      expect(parsed.key).toBe('PAY-123');
      expect(parsed.title).toBe('Fix international tax calculation');
    });

    it('parses Jira document title with dash-separated key', () => {
      const title = 'PROJ-789: Modernize authentication tokens · Jira';
      const parsed = JiraParser.parseDocumentTitle(title);
      expect(parsed.key).toBe('PROJ-789');
      expect(parsed.title).toBe('Modernize authentication tokens');
    });

    it('handles document title without Jira key', () => {
      const title = 'Sprint Backlog - Jira';
      const parsed = JiraParser.parseDocumentTitle(title);
      expect(parsed.key).toBeNull();
      expect(parsed.title).toBe('Sprint Backlog');
    });
  });

  describe('sanitizeDescription', () => {
    it('strips HTML tags and normalizes spaces', () => {
      const html = '<p>First line <b>bold text</b></p><br/><div>Second line</div>';
      const sanitized = JiraParser.sanitizeDescription(html);
      expect(sanitized).toBe('First line bold text Second line');
    });

    it('truncates text beyond max length cleanly', () => {
      const longText = 'A'.repeat(500);
      const sanitized = JiraParser.sanitizeDescription(longText, 100);
      expect(sanitized.length).toBe(100);
    });
  });
});
