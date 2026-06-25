import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUser, getProfile } from "@/lib/auth";
import { saveLetterForProfile } from "@/server/letters/save-letter";

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

  const result = await saveLetterForProfile({
    lookup: { kind: "id", id: letterId },
    request,
    userId: user.id,
    profileId: profile.id,
  });

  if (result.status === "cannot_save") {
    // Expired, already saved, not the opener, or letter doesn't exist —
    // reveal nothing specific.
    return NextResponse.json({ status: "cannot_save" }, { status: 409 });
  }

  // ── 5. Success — do NOT return body ───────────────────────────────────────
  return NextResponse.json({ status: "saved" });
}
