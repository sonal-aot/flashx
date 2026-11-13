import { FlashXSettings } from '../../types/settings';

export const DEFAULT_ALLOWED_PREFIXES: string[] = [
  'feat/',
  'bugfix/',
  'fix/',
  'security/',
  'hotfix/',
  'chore/',
  'refactor/',
  'docs/',
  'test/',
  'perf/',
  'ci/',
];

export const DEFAULT_SETTINGS: FlashXSettings = {
  activeProvider: 'gemini',
  selectedModels: {
    gemini: 'gemini-3.8-flash',
    openai: 'gpt-4o-mini',
    claude: 'claude-3-5-haiku-20241022',
  },
  naming: {
    template: '{type}/{ticket}-{description}',
    ticketPosition: 'before-desc',
    separator: '-',
    casing: 'lowercase',
    maxLength: 50,
    includeKey: true,
    allowedPrefixes: DEFAULT_ALLOWED_PREFIXES,
    defaultPrefix: 'feat/',
  },
  theme: 'system',
  autoCopy: false,
  hasCompletedOnboarding: false,
  historyLimit: 50,
  customJiraDomains: [],
};
