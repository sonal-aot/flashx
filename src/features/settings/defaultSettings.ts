import { FlashXSettings } from '../../types/settings';

export const DEFAULT_ALLOWED_PREFIXES: string[] = [
  'feature/',
  'bugfix/',
  'hotfix/',
  'chore/',
  'enhancement/',
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
    maxLength: 60,
    includeKey: true,
    allowedPrefixes: DEFAULT_ALLOWED_PREFIXES,
    defaultPrefix: 'feature/',
  },
  theme: 'system',
  autoCopy: false,
  hasCompletedOnboarding: false,
  historyLimit: 50,
  customJiraDomains: [],
};
