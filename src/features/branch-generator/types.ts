import { z } from 'zod';

export const AIBranchResponseSchema = z.object({
  recommended: z.string().min(1, 'Recommended branch name cannot be empty.'),
  alternatives: z.array(z.string().min(1)).min(1, 'At least one alternative must be provided.').max(5),
  reason: z.string().min(1, 'A rationale must be provided.'),
});

export type RawAIBranchResponse = z.infer<typeof AIBranchResponseSchema>;

/**
 * Extracts and parses JSON from raw LLM text response,
 * stripping markdown fences or stray commentary.
 */
export function parseAndValidateAIResponse(rawText: string): RawAIBranchResponse {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI provider.');
  }

  let cleaned = rawText.trim();

  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Look for JSON object boundaries { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not contain a valid JSON object.');
  }

  const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSubstring);
  } catch (jsonErr) {
    throw new Error(`Failed to parse AI JSON response: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
  }

  // Validate with Zod
  const result = AIBranchResponseSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`AI response failed schema validation: ${errorDetails}`);
  }

  return result.data;
}
