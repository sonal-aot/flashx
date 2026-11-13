import { describe, it, expect } from 'vitest';
import { GitBranchValidator } from '../src/utils/gitBranchValidator';

describe('GitBranchValidator', () => {
  describe('validate', () => {
    it('accepts compliant branch names', () => {
      const validBranches = [
        'feature/PROJ-123-new-login-flow',
        'bugfix/PAY-45-fix-tax-rate',
        'refactor/CORE-9-cleanup-middleware',
        'main',
        'releases/v2.1.0',
      ];

      for (const branch of validBranches) {
        const res = GitBranchValidator.validate(branch);
        expect(res.isValid, `Expected "${branch}" to be valid`).toBe(true);
        expect(res.errors).toHaveLength(0);
      }
    });

    it('rejects branch names containing consecutive dots (..)', () => {
      const res = GitBranchValidator.validate('bugfix/foo..bar');
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('consecutive dots'))).toBe(true);
    });

    it('rejects branch names containing consecutive slashes (//)', () => {
      const res = GitBranchValidator.validate('bugfix//foo-bar');
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('consecutive slashes'))).toBe(true);
    });

    it('rejects branch names starting or ending with slash', () => {
      expect(GitBranchValidator.validate('/bugfix/foo').isValid).toBe(false);
      expect(GitBranchValidator.validate('bugfix/foo/').isValid).toBe(false);
    });

    it('rejects branch names starting or ending with dot', () => {
      expect(GitBranchValidator.validate('.bugfix/foo').isValid).toBe(false);
      expect(GitBranchValidator.validate('bugfix/foo.').isValid).toBe(false);
    });

    it('rejects branch names ending with .lock', () => {
      const res = GitBranchValidator.validate('feature/foo.lock');
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('.lock'))).toBe(true);
    });

    it('rejects branch names with invalid git characters (~ ^ : ? * [ \\ @{)', () => {
      expect(GitBranchValidator.validate('feature/foo~bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo^bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo:bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo?bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo*bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo[bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo\\bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo@{bar').isValid).toBe(false);
    });

    it('rejects branch names with spaces or control characters', () => {
      expect(GitBranchValidator.validate('feature/foo bar').isValid).toBe(false);
      expect(GitBranchValidator.validate('feature/foo\tbar').isValid).toBe(false);
    });

    it('rejects single @', () => {
      expect(GitBranchValidator.validate('@').isValid).toBe(false);
    });

    it('validates maximum length limit', () => {
      const longBranch = 'feature/' + 'a'.repeat(60);
      const res = GitBranchValidator.validate(longBranch, 50);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('exceeds maximum length'))).toBe(true);
    });
  });

  describe('sanitize', () => {
    it('sanitizes spaces, special characters, and uppercase into clean branch name', () => {
      const raw = 'bugfix/PAY-123 Fix Tax: International & Domestic (v2)!';
      const sanitized = GitBranchValidator.sanitize(raw);
      expect(sanitized).toBe('bugfix/PAY-123-Fix-Tax-International-Domestic-v2');
    });

    it('collapses multiple consecutive dashes or separators', () => {
      const raw = 'feature/PROJ-999---some---messy---branch';
      expect(GitBranchValidator.sanitize(raw)).toBe('feature/PROJ-999-some-messy-branch');
    });

    it('removes leading/trailing separators and dots', () => {
      const raw = '---feature/..PROJ-123-task..---';
      expect(GitBranchValidator.sanitize(raw)).toBe('feature/PROJ-123-task');
    });

    it('strips .lock suffix during sanitization', () => {
      const raw = 'feature/branch.lock';
      expect(GitBranchValidator.sanitize(raw)).toBe('feature/branch');
    });

    it('respects maxLength and trims trailing dashes', () => {
      const raw = 'feature/PROJ-123-very-long-descriptive-branch-name-that-exceeds-limit';
      const sanitized = GitBranchValidator.sanitize(raw, 30);
      expect(sanitized.length).toBeLessThanOrEqual(30);
      expect(sanitized.endsWith('-')).toBe(false);
    });
  });
});
