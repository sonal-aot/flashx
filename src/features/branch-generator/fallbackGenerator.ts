import { JiraIssue } from '../../types/jira';
import { BranchNamingConfig } from '../../types/settings';
import { BranchGenerationResult } from '../../types/ai';
import { TemplateEngine } from '../../utils/templateEngine';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'this', 'that', 'from', 'as', 'into'
]);

export class FallbackGenerator {
  /**
   * Deterministically generates clean branch names locally without calling an LLM
   */
  static generate(issue: JiraIssue, config: BranchNamingConfig): BranchGenerationResult {
    const prefix = this.detectPrefix(issue, config);
    const keywords = this.extractKeywords(issue.title);

    // Variation 1: Main keywords (up to 4 words)
    const desc1 = keywords.slice(0, 4).join(config.separator);

    // Variation 2: Shorter (2-3 words)
    const desc2 = keywords.slice(0, 3).join(config.separator);

    // Variation 3: Action-focused
    const actionWords = keywords.filter((w) => !['issue', 'ticket', 'jira', 'bug'].includes(w));
    const desc3 = (actionWords.length > 0 ? actionWords : keywords).slice(0, 4).join(config.separator);

    const recommended = TemplateEngine.render(
      { type: prefix, ticket: issue.key, description: desc1 || 'task' },
      config
    );

    const alt1 = TemplateEngine.render(
      { type: prefix, ticket: issue.key, description: desc2 || 'update' },
      config
    );

    const alt2 = TemplateEngine.render(
      { type: prefix, ticket: issue.key, description: desc3 || 'changes' },
      config
    );

    // Ensure distinct alternatives
    const alternatives = [alt1, alt2].filter((a) => a !== recommended);
    if (alternatives.length === 0) {
      alternatives.push(
        TemplateEngine.render(
          { type: prefix, ticket: issue.key, description: `${desc1 || 'task'}-update` },
          config
        )
      );
    }

    return {
      recommended,
      alternatives,
      reason: `Offline rule-based generation: Classified as "${prefix}" from ticket type (${issue.issueType}) and title context.`,
      detectedPrefix: prefix,
    };
  }

  private static detectPrefix(issue: JiraIssue, config: BranchNamingConfig): string {
    const text = `${issue.title} ${issue.description || ''} ${issue.issueType}`.toLowerCase();

    if (/\b(hotfix|urgent|critical|sev-?1|p0|outage|production\s*crash)\b/.test(text)) {
      return config.allowedPrefixes.includes('hotfix/') ? 'hotfix/' : 'bugfix/';
    }
    if (/\b(bug|fix|patch|broken|error|crash|regression|failure)\b/.test(text) || issue.issueType.toLowerCase().includes('bug')) {
      return 'bugfix/';
    }
    if (/\b(refactor|clean-?up|restructure|modernize|tech-?debt)\b/.test(text)) {
      return config.allowedPrefixes.includes('refactor/') ? 'refactor/' : 'chore/';
    }
    if (/\b(doc|docs|readme|documentation|swagger|openapi|guide)\b/.test(text)) {
      return config.allowedPrefixes.includes('docs/') ? 'docs/' : 'chore/';
    }
    if (/\b(test|tests|spec|specs|coverage|e2e|unit\s*test)\b/.test(text)) {
      return config.allowedPrefixes.includes('test/') ? 'test/' : 'chore/';
    }
    if (/\b(ci|cd|pipeline|github\s*actions|docker|workflow|deploy)\b/.test(text)) {
      return config.allowedPrefixes.includes('ci/') ? 'ci/' : 'chore/';
    }
    if (/\b(perf|performance|optimize|latency|speed|memory\s*leak)\b/.test(text)) {
      return config.allowedPrefixes.includes('perf/') ? 'perf/' : 'enhancement/';
    }
    if (/\b(enhance|improve|better|upgrade\s*ui)\b/.test(text)) {
      return config.allowedPrefixes.includes('enhancement/') ? 'enhancement/' : 'feature/';
    }
    if (/\b(chore|dependency|dependencies|bump|npm|yarn)\b/.test(text)) {
      return 'chore/';
    }

    return config.defaultPrefix || 'feature/';
  }

  private static extractKeywords(title: string): string[] {
    const clean = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return clean
      .split(' ')
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  }
}
