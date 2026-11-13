import { describe, it, expect } from 'vitest';
import { parseAndValidateAIResponse } from '../src/features/branch-generator/types';

describe('AI Response Validation & Parsing', () => {
  it('parses pure valid JSON response', () => {
    const raw = JSON.stringify({
      recommended: 'bugfix/PAY-123-fix-international-tax',
      alternatives: [
        'bugfix/PAY-123-correct-tax-rate',
        'bugfix/PAY-123-country-tax-calculation',
      ],
      reason: 'Fixes international tax calculation logic for cross-border orders.',
    });

    const parsed = parseAndValidateAIResponse(raw);
    expect(parsed.recommended).toBe('bugfix/PAY-123-fix-international-tax');
    expect(parsed.alternatives).toHaveLength(2);
    expect(parsed.reason).toContain('Fixes international tax');
  });

  it('strips markdown code blocks (```json ... ```)', () => {
    const raw = `Here is the generated Git branch:
\`\`\`json
{
  "recommended": "feature/AUTH-42-oauth-pkce",
  "alternatives": [
    "feature/AUTH-42-pkce-flow",
    "feature/AUTH-42-oauth2-enhancement"
  ],
  "reason": "Adds OAuth 2.0 with PKCE authorization flow."
}
\`\`\``;

    const parsed = parseAndValidateAIResponse(raw);
    expect(parsed.recommended).toBe('feature/AUTH-42-oauth-pkce');
    expect(parsed.alternatives).toHaveLength(2);
  });

  it('throws error when JSON object is missing', () => {
    const raw = 'I am unable to generate a branch for this ticket.';
    expect(() => parseAndValidateAIResponse(raw)).toThrow(
      'AI response did not contain a valid JSON object.'
    );
  });

  it('throws error when schema validation fails (missing required field)', () => {
    const raw = JSON.stringify({
      recommended: 'feature/FEAT-1',
      // Missing alternatives and reason
    });
    expect(() => parseAndValidateAIResponse(raw)).toThrow(
      'AI response failed schema validation'
    );
  });
});
