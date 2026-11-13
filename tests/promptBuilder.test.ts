import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../src/features/branch-generator/promptBuilder';
import { DEFAULT_SETTINGS } from '../src/features/settings/defaultSettings';
import { JiraIssue } from '../src/types/jira';

describe('PromptBuilder', () => {
  const sampleIssue: JiraIssue = {
    key: 'PAY-123',
    title: 'Fix incorrect tax calculation for international orders',
    description: 'Update calculation logic to apply country-specific rate.',
    issueType: 'Bug',
    projectKey: 'PAY',
    url: 'https://jira.example.com/browse/PAY-123',
    priority: 'High',
    status: 'In Progress',
    detectedAt: Date.now(),
  };

  it('builds system prompt with classification intent rules and allowed prefixes', () => {
    const prompt = PromptBuilder.build({
      issue: sampleIssue,
      config: DEFAULT_SETTINGS.naming,
      apiKey: 'test-key',
      model: 'test-model',
    });

    expect(prompt.systemPrompt).toContain('CRITICAL CLASSIFICATION & INTENT RULES');
    expect(prompt.systemPrompt).toContain('refactor/');
    expect(prompt.systemPrompt).toContain('hotfix/');
    expect(prompt.systemPrompt).toContain('docs/');
    expect(prompt.systemPrompt).toContain('test/');
    expect(prompt.systemPrompt).toContain('ci/');
    expect(prompt.systemPrompt).toContain('SECURITY & PROMPT INJECTION DEFENSE');
    expect(prompt.systemPrompt).toContain('RESPONSE FORMAT:');
  });

  it('builds user prompt encapsulating Jira details safely as untrusted data', () => {
    const prompt = PromptBuilder.build({
      issue: sampleIssue,
      config: DEFAULT_SETTINGS.naming,
      apiKey: 'test-key',
      model: 'test-model',
    });

    expect(prompt.userPrompt).toContain('TICKET KEY: PAY-123');
    expect(prompt.userPrompt).toContain('ISSUE TYPE: Bug');
    expect(prompt.userPrompt).toContain('TITLE: Fix incorrect tax calculation for international orders');
    expect(prompt.userPrompt).toContain('DESCRIPTION:');
  });
});
