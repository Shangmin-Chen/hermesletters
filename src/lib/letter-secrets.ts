/**
 * Shared, isomorphic helpers for the intimate prompt flow. Hashing lives in
 * letter-security.ts because it requires server-only secrets.
 */

/** Normalize answers for forgiving comparison: trim + lowercase only. */
export function normalizeSecretAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

/**
 * Build a safe answer-shape hint. Spaces remain visible as gaps; every other
 * character becomes an underline placeholder.
 */
export function secretAnswerShape(answer: string): string {
  return answer.trim().replace(/[^ ]/g, "_");
}

export function promptOk(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function answerOk(answer: string): boolean {
  return normalizeSecretAnswer(answer).length > 0;
}
