/**
 * Shared validation predicates for composing a letter.
 *
 * These are shared by the form and the server action so the two never drift.
 * The server remains the authoritative validator; the client uses native form
 * constraints for basic flow.
 *
 * Keep this module dependency-light and isomorphic — it must run unchanged on
 * the server (Node) and in the browser. `slugify` is already isomorphic.
 */
import { slugify } from "@/lib/slugify";

/** Discriminator used by the server action's return type to route an error
 *  back to the form field that owns the offending value. */
export type FieldKey = "receiver" | "letter" | "body" | "question" | "answer";

/**
 * A letter body is acceptable when it has at least one non-whitespace char.
 * Inner/outer whitespace is preserved on submit; we only require it isn't blank.
 * AC: "  x " → true (trims to "x").
 */
export function bodyOk(s: string): boolean {
  return s.trim().length > 0;
}

/**
 * A slug-bound field (receiver name / letter name) is acceptable only when the
 * SLUGIFIED result is non-empty. This catches inputs that look non-empty but
 * slugify away to nothing (e.g. "💌💌" → "") on the client, instead of letting
 * the user discover it two steps later at the server.
 * AC: "💌💌" → false; "Jane" → true.
 */
export function slugFieldOk(s: string): boolean {
  return slugify(s).length > 0;
}

/**
 * The secret is acceptable when BOTH the question and the answer have at least
 * one non-whitespace character. The answer's content is never inspected beyond
 * non-emptiness here (and never persisted anywhere on the client).
 */
export function secretOk(question: string, answer: string): boolean {
  return question.trim().length > 0 && answer.trim().length > 0;
}
