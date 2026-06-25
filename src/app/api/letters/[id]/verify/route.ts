import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { setClaimCookie } from "@/server/letters/claim-cookie";
import { claimInviteLetter } from "@/server/letters/claim-invite-letter";

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

  const result = await claimInviteLetter({
    lookup: { kind: "id", id: letterId },
    token,
    guess,
    request,
  });

  if (result.status === "not_found") {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (result.status === "expired") {
    return NextResponse.json({ status: "expired" });
  }
  if (result.status === "already_opened") {
    return NextResponse.json({ status: "already_opened" });
  }
  if (result.status === "invalid_link") {
    return NextResponse.json({ status: "invalid_link" }, { status: 404 });
  }
  if (result.status === "rate_limited") {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }
  if (result.status === "incorrect") {
    return NextResponse.json({ status: "incorrect" });
  }

  const response = NextResponse.json({ status: "unlocked" });
  setClaimCookie(response, result.cookie);

  return response;
}
