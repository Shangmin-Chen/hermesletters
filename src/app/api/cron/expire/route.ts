import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, lte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterVerifyAttempts } from "@/db/schema";

// ---------------------------------------------------------------------------
// Authorization helper — constant-time comparison to avoid timing attacks
// ---------------------------------------------------------------------------

/**
 * Compares two strings in a way that does not short-circuit on the first
 * mismatched byte.  This prevents timing-oracle attacks that could let an
 * attacker enumerate valid secret prefixes.
 *
 * Note: for very different-length strings the early-length check itself leaks
 * a bit of information, but that is unavoidable without padding to a fixed
 * length.  For a cron secret this is an acceptable trade-off.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Handler — supports both GET (Vercel Cron) and POST (manual trigger / tests)
// ---------------------------------------------------------------------------

async function handler(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authorization ───────────────────────────────────────────────────────
  //
  // Vercel Cron sends the secret as "Authorization: Bearer <CRON_SECRET>".
  // We require the same format here and reject anything that doesn't match.
  // If CRON_SECRET is not configured we refuse all requests defensively.

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // CRON_SECRET is not configured — refuse rather than run unprotected.
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── 2. Flip expired letters ────────────────────────────────────────────────
  //
  // HOUSEKEEPING NOTE: Read-time guards in the locked page and verify route
  // already treat any letter where (status = 'opened' AND saved_by IS NULL AND
  // expires_at <= now()) as expired and refuse to serve its content.  This
  // UPDATE is therefore housekeeping only — it keeps the `status` column
  // consistent with observed reality so that RLS SELECT policies and the
  // Received-mail view never see stale states.  It is safe to run this update
  // multiple times (idempotent: rows already set to 'expired' are excluded by
  // the WHERE clause).
  //
  // We do NOT delete letter rows or images.  Per the SPEC: "Data is retained
  // but inaccessible to everyone."
  const flipped = await db
    .update(letters)
    .set({ status: "expired" })
    .where(
      and(
        eq(letters.status, "opened"),
        isNull(letters.savedBy),
        lte(letters.expiresAt, sql`now()`)
      )
    )
    .returning({ id: letters.id });

  const expiredCount = flipped.length;

  // ── 3. Prune stale rate-limit rows ────────────────────────────────────────
  //
  // The verify route prunes per-letter on each access (within the rolling
  // window).  This DELETE catches the remainder: rows for letters that haven't
  // had a verify call recently, preventing unbounded table growth.
  //
  // Safe interval: 1 hour.  The durable rate-limit window is 10 minutes, so
  // any row older than 1 hour is well outside any active window and safe to
  // discard.  Data preserved: letter rows and images are untouched.
  const staleThreshold = sql`now() - interval '1 hour'`;

  const pruned = await db
    .delete(letterVerifyAttempts)
    .where(lt(letterVerifyAttempts.createdAt, staleThreshold))
    .returning({ id: letterVerifyAttempts.id });

  const prunedCount = pruned.length;

  // ── 4. Return summary (no sensitive data) ─────────────────────────────────
  return NextResponse.json({ expired: expiredCount, prunedAttempts: prunedCount });
}

export const GET = handler;
export const POST = handler;
