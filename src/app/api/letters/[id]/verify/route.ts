import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, lt, count } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterVerifyAttempts } from "@/db/schema";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory (best-effort, per-IP, per-instance)
// ---------------------------------------------------------------------------
//
// DURABILITY CAVEAT: This is an in-memory fixed-window counter. It is
// best-effort and per-instance only — it does NOT share state across multiple
// Next.js server instances or Vercel edge/lambda workers. It is kept as a
// fast, low-overhead first line of defense against obvious abuse from a single
// IP. The AUTHORITATIVE brute-force cap is the durable per-letter check below.
//
// Window: 5 minutes. Max attempts per (letterId, IP) within the window.

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 10; // per (letterId, IP) per window

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Map key: `${letterId}:${ip}`
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request should be rate-limited (limit exceeded).
 * Increments the counter if not yet exceeded.
 */
function isRateLimited(letterId: string, ip: string): boolean {
  const key = `${letterId}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Start a new window
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return true;
  }

  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// Durable per-letter rate limit constants
// ---------------------------------------------------------------------------
//
// This is the AUTHORITATIVE cap. It counts all verify attempts against a given
// letter within a rolling window, regardless of IP or server instance, using
// the letter_verify_attempts table (Postgres, service role, bypasses RLS).
//
// An attacker who spoofs X-Forwarded-For or hits multiple server instances
// will still be blocked once this cap is hit.
//
// Window: 10 minutes. Max total attempts per letter within the window.
const DURABLE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DURABLE_MAX_ATTEMPTS = 20; // per letter per window, across all IPs/instances

// ---------------------------------------------------------------------------
// POST /api/letters/[id]/verify
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: letterId } = await params;

  // ── 1. Derive client IP for best-effort per-IP rate limiting ──────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // ── 2. Per-IP in-memory check (fast, best-effort secondary) ───────────────
  if (isRateLimited(letterId, ip)) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429 }
    );
  }

  // ── 3. Parse guess from request body ──────────────────────────────────────
  let guess: string;
  try {
    const body = (await request.json()) as { guess?: unknown };
    if (typeof body.guess !== "string") {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }
    guess = body.guess;
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  // ── 4. Load the letter (server-side Drizzle, bypasses RLS) ────────────────
  //
  // SECURITY: We select ONLY the fields needed for this route.
  // The body, imageUrls, and other sensitive fields are never selected here —
  // this response never returns letter content to the client.
  const [row] = await db
    .select({
      id: letters.id,
      status: letters.status,
      openedAt: letters.openedAt,
      expiresAt: letters.expiresAt,
      savedBy: letters.savedBy,
      answerNormalized: letters.answerNormalized,
    })
    .from(letters)
    .where(eq(letters.id, letterId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const now = new Date();

  // ── 5. Read-time expiry guard ──────────────────────────────────────────────
  const isExpiredByTime =
    row.expiresAt !== null && row.savedBy === null && now >= row.expiresAt;

  if (row.status === "expired" || isExpiredByTime) {
    return NextResponse.json({ status: "expired" });
  }

  if (row.status === "saved" || row.status === "opened") {
    // Letter already claimed — no need to record an attempt
    return NextResponse.json({ status: "already_opened" });
  }

  // ── 6. Durable per-letter rate limit (AUTHORITATIVE brute-force cap) ──────
  //
  // Cleanup: delete attempts older than the window (keeps the table lean).
  const windowStart = new Date(now.getTime() - DURABLE_WINDOW_MS);

  await db
    .delete(letterVerifyAttempts)
    .where(
      and(
        eq(letterVerifyAttempts.letterId, letterId),
        lt(letterVerifyAttempts.createdAt, windowStart)
      )
    );

  // Count remaining attempts for this letter in the window.
  const [{ attemptCount }] = await db
    .select({ attemptCount: count() })
    .from(letterVerifyAttempts)
    .where(eq(letterVerifyAttempts.letterId, letterId));

  if (attemptCount >= DURABLE_MAX_ATTEMPTS) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429 }
    );
  }

  // ── 7. Record this attempt (counts toward the cap for all subsequent requests)
  await db.insert(letterVerifyAttempts).values({ letterId });

  // ── 8. Answer comparison ───────────────────────────────────────────────────
  //
  // Case-insensitive + outer-whitespace trim. Inner spaces and punctuation
  // are preserved in both the stored normalized form and the guess.
  const normalizedGuess = guess.trim().toLowerCase();

  if (normalizedGuess !== row.answerNormalized) {
    // Do NOT reveal how close the guess was.
    return NextResponse.json({ status: "incorrect" });
  }

  // ── 9. ATOMIC CLAIM ───────────────────────────────────────────────────────
  //
  // Single conditional UPDATE with opened_at IS NULL guard.
  // Only the first correct guesser gets a row back. A concurrent second
  // correct guess finds opened_at already set and gets no row → "already_opened".
  const newClaimToken = crypto.randomUUID();
  const openedAt = now;
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

  const updated = await db
    .update(letters)
    .set({
      openedAt,
      claimToken: newClaimToken,
      expiresAt,
      status: "opened",
    })
    .where(and(eq(letters.id, letterId), isNull(letters.openedAt)))
    .returning({ id: letters.id, claimToken: letters.claimToken });

  if (updated.length === 0) {
    // Race condition: another request claimed it between our read and this write.
    return NextResponse.json({ status: "already_opened" });
  }

  // ── 10. Set httpOnly claim cookie ──────────────────────────────────────────
  //
  // Cookie attributes (SPEC requirement):
  //   - httpOnly: JS in the browser cannot read it (XSS mitigation)
  //   - Secure: only sent over HTTPS — BUT a Secure cookie set over a plain-HTTP
  //     connection is silently DROPPED by the browser. We therefore mark it
  //     Secure only when the request actually arrived over HTTPS, so the claim
  //     cookie persists in local/tunnelled HTTP dev (where it would otherwise be
  //     dropped, leaving the opener locked out of a letter they just claimed)
  //     while staying Secure in production. We trust x-forwarded-proto (set by
  //     the platform/Cloudflare/Vercel proxy), falling back to the URL protocol.
  //   - SameSite=Lax: CSRF protection while allowing top-level navigations
  //   - path=/: scoped to the entire site (cookie is keyed by letterId in name)
  //   - maxAge: 24h matching the grace window
  const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const isHttps =
    forwardedProto === "https" || request.nextUrl.protocol === "https:";

  const response = NextResponse.json({ status: "unlocked" });
  response.cookies.set(`claim:${letterId}`, newClaimToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: TWENTY_FOUR_HOURS_SECONDS,
  });

  return response;
}
