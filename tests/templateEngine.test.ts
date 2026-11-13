import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/utils/templateEngine';
import { DEFAULT_SETTINGS } from '../src/features/settings/defaultSettings';

describe('TemplateEngine', () => {
  const baseConfig = DEFAULT_SETTINGS.naming;

  it('renders default template "{type}/{ticket}-{description}"', () => {
    const rendered = TemplateEngine.render(
      {
        type: 'bugfix',
        ticket: 'PAY-123',
        description: 'fix-international-tax',
      },
      baseConfig
    );
    expect(rendered).toBe('bugfix/pay-123-fix-international-tax');
  });

  it('renders ticket-first template "{ticket}/{type}-{description}"', () => {
    const config = {
      ...baseConfig,
      template: '{ticket}/{type}-{description}',
    };
    const rendered = TemplateEngine.render(
      {
        type: 'feature',
        ticket: 'CORE-88',
        description: 'oauth-provider',
      },
      config
    );
    expect(rendered).toBe('core-88/feature-oauth-provider');
  });

  it('renders description-first template "{type}/{description}-{ticket}"', () => {
    const config = {
      ...baseConfig,
      template: '{type}/{description}-{ticket}',
    };
    const rendered = TemplateEngine.render(
      {
        type: 'refactor',
        ticket: 'AUTH-10',
        description: 'cleanup-session',
      },
      config
    );
    expect(rendered).toBe('refactor/cleanup-session-auth-10');
  });

  it('supports "preserve-ticket" casing style', () => {
    const config = {
      ...baseConfig,
      casing: 'preserve-ticket' as const,
    };
    const rendered = TemplateEngine.render(
      {
        type: 'bugfix',
        ticket: 'PROJ-777',
        description: 'null-pointer-crash',
      },
      config
    );
    expect(rendered).toBe('bugfix/PROJ-777-null-pointer-crash');
  });

  it('supports underscore separator', () => {
    const config = {
      ...baseConfig,
      separator: '_' as const,
      template: '{type}/{ticket}_{description}',
    };
    const rendered = TemplateEngine.render(
      {
        type: 'chore',
        ticket: 'DEPS-40',
        description: 'bump_vite',
      },
      config
    );
    expect(rendered).toBe('chore/deps-40_bump_vite');
  });

  it('handles includeKey = false cleanly without leaving dangling hyphens', () => {
    const config = {
      ...baseConfig,
      includeKey: false,
    };
    const rendered = TemplateEngine.render(
      {
        type: 'docs',
        ticket: 'DOC-5',
        description: 'update-readme',
      },
      config
    );
    expect(rendered).toBe('docs/update-readme');
  });

  it('parses branch name back into tokens', () => {
    const parsed = TemplateEngine.parseBranch('feature/PAY-123-fix-tax');
    expect(parsed.type).toBe('feature');
    expect(parsed.ticket).toBe('PAY-123');
    expect(parsed.description).toBe('fix-tax');
  });
});
