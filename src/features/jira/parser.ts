/**
 * Helper utilities for parsing Jira URLs, text, and keys
 */

// Matches standard Jira issue keys: e.g., PROJ-123, ABC2-456
const JIRA_KEY_REGEX = /([A-Z][A-Z0-9]+-[0-9]+)/i;

export class JiraParser {
  /**
   * Extracts the Jira issue key from a URL or string
   */
  static extractIssueKey(input: string): string | null {
    if (!input) return null;

    // Check query params first (e.g. selectedIssue=PROJ-123)
    try {
      if (input.includes('selectedIssue=')) {
        const url = new URL(input);
        const selected = url.searchParams.get('selectedIssue');
        if (selected && JIRA_KEY_REGEX.test(selected)) {
          return selected.toUpperCase();
        }
      }
    } catch {
      // not a full URL, continue regex search
    }

    // Check browse path: /browse/PROJ-123
    const browseMatch = input.match(/\/browse\/([A-Z][A-Z0-9]+-[0-9]+)/i);
    if (browseMatch && browseMatch[1]) {
      return browseMatch[1].toUpperCase();
    }

    // Generic key match
    const match = input.match(JIRA_KEY_REGEX);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Extracts the project key (prefix) from a Jira issue key
   * e.g., "PROJ-123" -> "PROJ"
   */
  static extractProjectKey(issueKey: string): string {
    const parts = issueKey.split('-');
    return parts[0] ? parts[0].toUpperCase() : '';
  }

  /**
   * Extracts issue key and title from document.title fallback
   * e.g., "[PROJ-123] Fix checkout button crash - Jira"
   */
  static parseDocumentTitle(docTitle: string): { key: string | null; title: string | null } {
    if (!docTitle) return { key: null, title: null };

    // Clean out trailing Jira branding: " - Jira", " · Jira", " | Jira"
    const cleaned = docTitle.replace(/\s*[-·|]\s*(Jira|Atlassian).*$/i, '').trim();

    const key = this.extractIssueKey(cleaned);
    let title: string | null = null;

    if (key) {
      // Strip bracketed key or prefix key
      const titleWithoutKey = cleaned
        .replace(new RegExp(`^\\[?${key}\\]?\\s*[-:]?\\s*`, 'i'), '')
        .trim();
      title = titleWithoutKey || null;
    } else {
      title = cleaned || null;
    }

    return { key, title };
  }

  /**
   * Cleans description text: strips excessive HTML, collapses multiple spaces, limits length
   */
  static sanitizeDescription(rawText: string, maxLength = 2000): string {
    if (!rawText) return '';

    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/[ \t]+/g, ' ')  // Collapse horizontal spaces
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
      .trim()
      .substring(0, maxLength);
  }
}
