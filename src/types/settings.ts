import { ProviderId } from './ai';

export type TicketPosition = 'before-desc' | 'after-desc' | 'prefix-root' | 'custom';
export type BranchCasing = 'lowercase' | 'preserve-ticket' | 'uppercase';
export type BranchSeparator = '-' | '_' | '/';

export interface BranchNamingConfig {
  template: string; // e.g. "{type}/{ticket}-{description}"
  ticketPosition: TicketPosition;
  separator: BranchSeparator;
  casing: BranchCasing;
  maxLength: number;
  includeKey: boolean;
  allowedPrefixes: string[];
  defaultPrefix: string;
}

export interface FlashXSettings {
  activeProvider: ProviderId;
  selectedModels: Record<ProviderId, string>;
  naming: BranchNamingConfig;
  theme: 'dark' | 'light' | 'system';
  autoCopy: boolean;
  hasCompletedOnboarding: boolean;
  historyLimit: number;
  customJiraDomains: string[];
}

export interface HistoryItem {
  id: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
  branchName: string;
  alternatives: string[];
  reason?: string;
  provider: ProviderId;
  model: string;
  timestamp: number;
}
