/**
 * Git Branch Name Validator and Sanitizer according to git-check-ref-format rules:
 *
 * 1. Cannot have two consecutive dots anywhere: ".."
 * 2. Cannot have ASCII control characters, space, tilde (~), caret (^), colon (:), question mark (?),
 *    asterisk (*), open bracket ([), or backslash (\)
 * 3. Cannot begin or end with a slash (/), and cannot contain multiple consecutive slashes (//)
 * 4. Cannot end with a dot (.)
 * 5. Cannot end with ".lock"
 * 6. Cannot contain sequence "@{"
 * 7. Cannot be just "@"
 */

export interface BranchValidationDetails {
  isValid: boolean;
  errors: string[];
  sanitized: string;
}

// Invalid git characters regex: spaces, controls, ~ ^ : ? * [ \
const INVALID_GIT_CHARS = /[\s~^:?*\[\\\]\x00-\x1f\x7f]/g;

export class GitBranchValidator {
  /**
   * Validates whether a candidate branch name is a valid git ref.
   */
  static validate(branchName: string, maxLength = 100): BranchValidationDetails {
    const errors: string[] = [];
    const name = branchName.trim();

    if (!name) {
      return {
        isValid: false,
        errors: ['Branch name cannot be empty.'],
        sanitized: '',
      };
    }

    if (name.length > maxLength) {
      errors.push(`Branch name exceeds maximum length of ${maxLength} characters (${name.length}).`);
    }

    if (INVALID_GIT_CHARS.test(name)) {
      errors.push('Branch name contains invalid characters (spaces, ~, ^, :, ?, *, [, \\, or control chars).');
    }

    if (name.includes('..')) {
      errors.push('Branch name cannot contain consecutive dots ("..").');
    }

    if (name.includes('//')) {
      errors.push('Branch name cannot contain consecutive slashes ("//").');
    }

    if (name.startsWith('/') || name.endsWith('/')) {
      errors.push('Branch name cannot start or end with a slash ("/").');
    }

    if (name.startsWith('.') || name.endsWith('.')) {
      errors.push('Branch name cannot start or end with a dot (".").');
    }

    if (name.endsWith('.lock')) {
      errors.push('Branch name cannot end with ".lock".');
    }

    if (name.includes('@{')) {
      errors.push('Branch name cannot contain sequence "@{".');
    }

    if (name === '@') {
      errors.push('Branch name cannot be single "@".');
    }

    const sanitized = this.sanitize(name, maxLength);

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Sanitizes any arbitrary text into a clean, compliant git branch name.
   */
  static sanitize(raw: string, maxLength = 60, separator = '-'): string {
    if (!raw) return '';

    let cleaned = raw.trim();

    // Strip leading/trailing hyphens, underscores, dots, or slashes first
    cleaned = cleaned.replace(/^[-_\/\.]+|[-_\/\.]+$/g, '');

    // Prevent .lock suffix before dots are replaced
    if (cleaned.endsWith('.lock')) {
      cleaned = cleaned.slice(0, -5);
    }

    // Preserve prefix if contains slash (e.g. "feature/something")
    let prefix = '';
    const slashIndex = cleaned.indexOf('/');
    if (slashIndex > 0) {
      const rawPrefix = cleaned.substring(0, slashIndex);
      // Clean prefix itself
      const cleanPrefix = rawPrefix.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase();
      prefix = cleanPrefix ? `${cleanPrefix}/` : '';
      cleaned = cleaned.substring(slashIndex + 1);
    }

    // Replace invalid characters with separator
    cleaned = cleaned.replace(INVALID_GIT_CHARS, separator);

    // Replace any remaining unsafe characters
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\-\/]/g, separator);

    // Collapse multiple consecutive separators or dots
    const sepEscaped = separator.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`${sepEscaped}+`, 'g'), separator);
    cleaned = cleaned.replace(/\/{2,}/g, '/');

    // Strip leading / trailing separators, slashes, and dots
    cleaned = cleaned.replace(new RegExp(`^${sepEscaped}+|${sepEscaped}+$`, 'g'), '');
    cleaned = cleaned.replace(/^[\/.]+|[\/.]+$/g, '');

    // Check .lock suffix again in case it survived
    if (cleaned.endsWith('.lock') || cleaned.endsWith('-lock')) {
      cleaned = cleaned.replace(/[-.]lock$/, '');
    }

    // Assemble prefix + cleaned name
    let result = prefix ? `${prefix}${cleaned}` : cleaned;

    // Enforce max length safely without cutting in middle of prefix
    if (result.length > maxLength) {
      result = result.substring(0, maxLength);
      // Clean up any dangling trailing separator or slash
      result = result.replace(/[-_\/\.]+$/, '');
    }

    return result;
  }
}
