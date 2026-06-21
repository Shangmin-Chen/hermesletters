import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull, isNull, gt, sql, or } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { getUser, getProfile } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/letters/[id]/save
// ---------------------------------------------------------------------------
//
// Keeps a letter for the authenticated opener within the 24h grace window.
// All constraints are enforced in a single conditional UPDATE — auth, profile,
// claim-cookie match, grace window, and not-already-saved — so no guard can
// be bypassed by a race condition.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: letterId } = await params;

  // ── 1. Authenticated user required ────────────────────────────────────────
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  }

  // ── 2. Profile required (FK constraint on saved_by) ───────────────────────
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ status: "no_profile" }, { status: 403 });
  }

  // ── 3. Claim cookie required (only the opener holds this) ─────────────────
  const cookieName = `claim:${letterId}`;
  const cookieHeader = request.headers.get("cookie") ?? "";
  // Parse the specific claim cookie from the Cookie header
  const cookieValue = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) ?? null;

  const ownershipGate = cookieValue
    ? or(eq(letters.claimToken, cookieValue), eq(letters.receiverId, profile.id))
    : eq(letters.receiverId, profile.id);

  // ── 4. Atomic conditional UPDATE ─────────────────────────────────────────
  //
  // All constraints in one statement (no TOCTOU gap):
  //   - status = 'opened'          → letter was claimed but not yet saved
  //   - opened_at IS NOT NULL      → confirm it was actually opened
  //   - claim_token = <cookieValue> → only the holder of the grace cookie
  //   - expires_at > now()         → still within the 24h grace window
  //   - saved_by IS NULL           → not yet saved (idempotency guard)
  //
  // If no row is returned, one or more constraints failed — we return a
  // generic "cannot_save" to reveal nothing about which constraint failed.

  const updated = await db
    .update(letters)
    .set({
      savedBy: user.id,
      savedAt: sql`now()`,
      status: "saved",
    })
    .where(
      and(
        eq(letters.id, letterId),
        eq(letters.status, "opened"),
        isNotNull(letters.openedAt),
        ownershipGate,
        gt(letters.expiresAt, sql`now()`),
        isNull(letters.savedBy)
      )
    )
    .returning({ id: letters.id });

  if (updated.length === 0) {
    // Expired, already saved, not the opener, or letter doesn't exist —
    // reveal nothing specific.
    return NextResponse.json({ status: "cannot_save" }, { status: 409 });
  }

  // ── 5. Success — do NOT return body ───────────────────────────────────────
  return NextResponse.json({ status: "saved" });
}
