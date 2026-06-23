import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { hashOpenToken, verifySecretAnswer } from "@/lib/letter-security";
import {
  inviteVerifyActorKey,
  recordVerifyAttemptWithinLimits,
} from "@/lib/letter-verify-rate-limit";

// ---------------------------------------------------------------------------
// POST /api/letters/[id]/verify
//
// Invite-letter contract: the request must carry both the random open token
// from the sealed link and the recipient's answer to the shared-secret prompt.
// If both pass and the letter is still unopened, this route atomically claims it:
// sets openedAt, issues a claim_token, and drops the `claim:{letterId}` cookie.
// The CLAIM-COOKIE CONTRACT is preserved exactly:
//   - cookie name:  `claim:{letterId}`
//   - cookie value: letters.claim_token  (a fresh UUID)
//   - httpOnly, Secure (only over HTTPS), SameSite=Lax, path=/, maxAge=24h
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: letterId } = await params;

  // ── 1. Parse token + answer from request body ────────────────────────────
  let token: string;
  let guess: string;
  try {
    const body = (await request.json()) as { token?: unknown; guess?: unknown };
    if (typeof body.token !== "string" || typeof body.guess !== "string") {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }
    token = body.token;
    guess = body.guess;
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  // ── 2. Load the letter (server-side Drizzle, bypasses RLS) ────────────────
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
      openTokenHash: letters.openTokenHash,
      secretAnswerHash: letters.secretAnswerHash,
      secretAnswerSalt: letters.secretAnswerSalt,
    })
    .from(letters)
    .where(eq(letters.id, letterId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const now = new Date();

  // ── 3. Read-time expiry guard ──────────────────────────────────────────────
  const isExpiredByTime =
    row.expiresAt !== null && row.savedBy === null && now >= row.expiresAt;

  if (row.status === "expired" || isExpiredByTime) {
    return NextResponse.json({ status: "expired" });
  }

  if (row.status === "saved" || row.status === "opened") {
    // Letter already claimed — nothing more to do.
    return NextResponse.json({ status: "already_opened" });
  }

  // ── 4. Open-token guard ───────────────────────────────────────────────────
  //
  // Human-readable slugs are presentation. The random token is the bearer
  // secret proving this is the original sealed link.
  if (!row.openTokenHash || hashOpenToken(token) !== row.openTokenHash) {
    return NextResponse.json({ status: "invalid_link" }, { status: 404 });
  }

  // ── 5. Durable answer-attempt caps ────────────────────────────────────────
  //
  // Preserve the global per-letter cap and add a per actor+letter cap using a
  // keyed digest of IP + user-agent. The attempt table never stores raw request
  // metadata.
  const rateLimit = await recordVerifyAttemptWithinLimits({
    letterId,
    actorKey: inviteVerifyActorKey(request),
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  if (!verifySecretAnswer(guess, row.secretAnswerSalt, row.secretAnswerHash)) {
    return NextResponse.json({ status: "incorrect" });
  }

  // ── 6. ATOMIC CLAIM ───────────────────────────────────────────────────────
  //
  // Single conditional UPDATE with opened_at IS NULL guard.
  // Only the first request gets a row back. A concurrent second request
  // finds opened_at already set and gets no row → "already_opened".
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

  // ── 7. Set httpOnly claim cookie ──────────────────────────────────────────
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
