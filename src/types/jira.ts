export type JiraIssueType =
  | 'Story'
  | 'Bug'
  | 'Task'
  | 'Epic'
  | 'Sub-task'
  | 'Improvement'
  | 'New Feature'
  | 'Technical Task'
  | 'Spike'
  | string;

export interface JiraIssue {
  key: string;              // e.g. "PROJ-123"
  title: string;            // e.g. "Fix incorrect tax calculation for international orders"
  description: string;      // Issue description preview or full text
  issueType: JiraIssueType; // "Bug", "Story", etc.
  projectKey: string;       // e.g. "PROJ"
  url: string;              // Jira ticket URL
  status?: string;          // e.g. "In Progress", "To Do"
  priority?: string;        // e.g. "High", "Critical", "Medium"
  detectedAt: number;       // Timestamp ms
}

export interface JiraExtractResponse {
  success: boolean;
  issue?: JiraIssue;
  error?: string;
  isJiraPage: boolean;
  isLoading?: boolean;
}

export type JiraMessage =
  | { type: 'GET_JIRA_ISSUE' }
  | { type: 'JIRA_ISSUE_CHANGED'; payload: JiraIssue | null }
  | { type: 'PING' };
