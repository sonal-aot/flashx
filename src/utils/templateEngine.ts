import { BranchNamingConfig } from '../types/settings';
import { GitBranchValidator } from './gitBranchValidator';

export interface TemplateParams {
  type: string;        // e.g. "bugfix" or "bugfix/"
  ticket: string;      // e.g. "PROJ-123"
  description: string; // e.g. "fix-international-tax"
}

export class TemplateEngine {
  /**
   * Applies the branch naming configuration to render the final Git branch name.
   */
  static render(params: TemplateParams, config: BranchNamingConfig): string {
    const { template, separator, casing, maxLength, includeKey } = config;

    // Clean up prefix (strip trailing slash for token interpolation if template adds slash)
    let cleanType = params.type.replace(/\/+$/, '').trim().toLowerCase();
    if (!cleanType) {
      cleanType = config.defaultPrefix.replace(/\/+$/, '') || 'feature';
    }

    // Clean ticket
    let cleanTicket = params.ticket.trim();
    if (!includeKey) {
      cleanTicket = '';
    }

    // Clean description
    let cleanDesc = params.description
      .replace(/[\s_]+/g, separator)
      .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');

    // Interpolate tokens into template
    let rendered = template;

    // If template contains {ticket} but includeKey is false or ticket is empty, handle separators around it
    if (!cleanTicket) {
      rendered = rendered
        .replace(/\{ticket\}[-_\/]/g, '')
        .replace(/[-_\/]\{ticket\}/g, '')
        .replace(/\{ticket\}/g, '');
    } else {
      rendered = rendered.replace(/\{ticket\}/g, cleanTicket);
    }

    rendered = rendered.replace(/\{type\}/g, cleanType);
    rendered = rendered.replace(/\{description\}/g, cleanDesc);

    // Apply casing rules
    if (casing === 'lowercase') {
      rendered = rendered.toLowerCase();
    } else if (casing === 'preserve-ticket') {
      // Convert to lowercase, but preserve/uppercase Jira ticket key pattern (e.g. PROJ-123)
      rendered = rendered.toLowerCase().replace(/([a-z][a-z0-9]*-[0-9]+)/gi, (m) => m.toUpperCase());
    }

    // Final sanitization through Git branch validator
    return GitBranchValidator.sanitize(rendered, maxLength, separator);
  }

  /**
   * Extracts prefix, ticket, and description parts from an AI-generated branch name
   */
  static parseBranch(branchName: string): TemplateParams {
    let type = '';
    let ticket = '';
    let description = '';

    const firstSlash = branchName.indexOf('/');
    let rest = branchName;
    if (firstSlash !== -1) {
      type = branchName.substring(0, firstSlash);
      rest = branchName.substring(firstSlash + 1);
    }

    // Find ticket key e.g. PROJ-123
    const ticketMatch = rest.match(/([A-Z0-9]+-[0-9]+)/i);
    if (ticketMatch) {
      ticket = ticketMatch[1];
      // Description is everything else
      description = rest
        .replace(ticketMatch[0], '')
        .replace(/^[-_\/]+|[-_\/]+$/g, '');
    } else {
      description = rest;
    }

    return { type, ticket, description };
  }
}
