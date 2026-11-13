import { GitBranchValidator } from './gitBranchValidator';
import { BranchNamingConfig } from '../types/settings';

/**
 * Normalizes, sanitizes, and applies casing and length rules to AI-generated branch names.
 */
export function formatBranchName(raw: string, config: BranchNamingConfig): string {
  let sanitized = GitBranchValidator.sanitize(raw, config.maxLength, config.separator);

  if (config.casing === 'lowercase') {
    sanitized = sanitized.toLowerCase();
  } else if (config.casing === 'preserve-ticket') {
    sanitized = sanitized
      .toLowerCase()
      .replace(/([a-z][a-z0-9]*-[0-9]+)/gi, (m) => m.toUpperCase());
  }

  return sanitized;
}
