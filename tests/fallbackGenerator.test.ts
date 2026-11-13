import { describe, it, expect } from 'vitest';
import { FallbackGenerator } from '../src/features/branch-generator/fallbackGenerator';
import { DEFAULT_SETTINGS } from '../src/features/settings/defaultSettings';
import { JiraIssue } from '../src/types/jira';

describe('FallbackGenerator (Offline Intent Engine)', () => {
  const config = DEFAULT_SETTINGS.naming;

  it('classifies story involving refactoring as "refactor/"', () => {
    const issue: JiraIssue = {
      key: 'AUTH-12',
      title: 'Refactor user session middleware and clean up legacy tokens',
      description: 'Restructure session handling without altering endpoints.',
      issueType: 'Story', // Jira Story, but actual intent is Refactor!
      projectKey: 'AUTH',
      url: 'https://test.atlassian.net/browse/AUTH-12',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('refactor/')).toBe(true);
  });

  it('classifies urgent production outage as "hotfix/"', () => {
    const issue: JiraIssue = {
      key: 'PAY-911',
      title: 'Production outage: memory leak causing worker crash',
      description: 'Emergency patch required immediately for production cluster.',
      issueType: 'Bug',
      projectKey: 'PAY',
      url: 'https://test.atlassian.net/browse/PAY-911',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('hotfix/')).toBe(true);
  });

  it('classifies documentation tasks as "docs/"', () => {
    const issue: JiraIssue = {
      key: 'DOC-4',
      title: 'Update Swagger OpenAPI documentation for billing endpoints',
      description: 'Add new schema examples.',
      issueType: 'Task',
      projectKey: 'DOC',
      url: 'https://test.atlassian.net/browse/DOC-4',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('docs/')).toBe(true);
  });

  it('classifies testing tasks as "test/"', () => {
    const issue: JiraIssue = {
      key: 'QA-55',
      title: 'Add Playwright E2E tests for onboarding checkout flow',
      description: 'Increase test coverage for payments.',
      issueType: 'Task',
      projectKey: 'QA',
      url: 'https://test.atlassian.net/browse/QA-55',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('test/')).toBe(true);
  });

  it('classifies CI/CD pipeline changes as "ci/"', () => {
    const issue: JiraIssue = {
      key: 'INFRA-8',
      title: 'Configure GitHub Actions CI workflow with Docker caching',
      description: 'Speed up pipeline runs.',
      issueType: 'Task',
      projectKey: 'INFRA',
      url: 'https://test.atlassian.net/browse/INFRA-8',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('ci/')).toBe(true);
  });

  it('classifies performance improvements as "perf/"', () => {
    const issue: JiraIssue = {
      key: 'DB-19',
      title: 'Optimize query latency and index customer orders table',
      description: 'Reduce p99 database latency.',
      issueType: 'Story',
      projectKey: 'DB',
      url: 'https://test.atlassian.net/browse/DB-19',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('perf/')).toBe(true);
  });

  it('classifies new features with "feat/" and never "feature/"', () => {
    const issue: JiraIssue = {
      key: 'M8F-640',
      title: 'BPMN-07: Multi-instance iteration-local data, runtime counters, output collection',
      description: 'Implement multi-instance activity execution in BPMN 2.0 engine.',
      issueType: 'Task',
      projectKey: 'M8F',
      url: 'https://aottech.atlassian.net/browse/M8F-640',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('feat/')).toBe(true);
    expect(res.recommended.startsWith('feature/')).toBe(false);
  });

  it('classifies security patches with "security/"', () => {
    const issue: JiraIssue = {
      key: 'SEC-101',
      title: 'Fix XSS vulnerability and sanitize HTML input in user profile',
      description: 'CVE remediation for Cross-Site Scripting via unsanitized rich text inputs.',
      issueType: 'Bug',
      projectKey: 'SEC',
      url: 'https://test.atlassian.net/browse/SEC-101',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('security/')).toBe(true);
  });

  it('classifies standard bug fixes with "bugfix/"', () => {
    const issue: JiraIssue = {
      key: 'PAY-404',
      title: 'Fix incorrect tax calculation when applying discount coupon',
      description: 'Coupon discounts cause negative tax computation on order summary.',
      issueType: 'Bug',
      projectKey: 'PAY',
      url: 'https://test.atlassian.net/browse/PAY-404',
      detectedAt: Date.now(),
    };

    const res = FallbackGenerator.generate(issue, config);
    expect(res.recommended.startsWith('bugfix/')).toBe(true);
  });
});
