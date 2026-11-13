import { JiraIssue } from '../../types/jira';

export interface JiraAdapter {
  readonly id: string;
  readonly name: string;
  /**
   * Checks whether this adapter can handle the given URL
   */
  isMatch(url: string, customDomains?: string[]): boolean;

  /**
   * Extracts the Jira issue details from the given DOM document or active window
   */
  extractIssue(document?: Document, currentUrl?: string): Promise<JiraIssue | null>;
}

export class JiraAdapterRegistry {
  private static adapters: JiraAdapter[] = [];

  static register(adapter: JiraAdapter): void {
    const existing = this.adapters.findIndex((a) => a.id === adapter.id);
    if (existing >= 0) {
      this.adapters[existing] = adapter;
    } else {
      this.adapters.push(adapter);
    }
  }

  static getAdapterForUrl(url: string, customDomains: string[] = []): JiraAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.isMatch(url, customDomains)) {
        return adapter;
      }
    }
    return null;
  }

  static getAll(): JiraAdapter[] {
    return [...this.adapters];
  }
}
