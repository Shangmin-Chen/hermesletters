import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isValidLetterPublicId } from "@/lib/letter-public-id";
import { setClaimCookie } from "@/server/letters/claim-cookie";
import {
  claimInviteLetter,
  type ClaimInviteLetterResult,
} from "@/server/letters/claim-invite-letter";
import { v2Error } from "@/app/api/v2/_lib/response";

type OpenClaimErrorStatus = Exclude<ClaimInviteLetterResult["status"], "unlocked">;

const OPEN_CLAIM_ERROR_MAP = {
  not_found: [404, "letter_not_found", "Letter was not found."],
  invalid_link: [404, "letter_not_found", "Letter was not found."],
  expired: [410, "letter_expired", "Letter has expired."],
  already_opened: [409, "letter_already_opened", "Letter has already been opened."],
  incorrect: [422, "incorrect_answer", "Answer is incorrect."],
  rate_limited: [429, "rate_limited", "Too many attempts."],
} as const satisfies Record<OpenClaimErrorStatus, readonly [number, string, string]>;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  if (!isValidLetterPublicId(publicId)) {
    return v2Error("invalid_letter_id", "Letter id is invalid.", 400);
  }

  let token: string;
  let answer: string;
  try {
    const body = (await request.json()) as { token?: unknown; answer?: unknown };
    if (typeof body.token !== "string" || typeof body.answer !== "string") {
      return v2Error("invalid_request", "token and answer are required.", 400);
    }
    token = body.token;
    answer = body.answer;
  } catch {
    return v2Error("invalid_request", "Request body must be valid JSON.", 400);
  }

  const result = await claimInviteLetter({
    lookup: { kind: "publicId", publicId },
    token,
    guess: answer,
    request,
  });

  if (result.status === "unlocked") {
    const response = NextResponse.json({ data: { status: "claimed" } }, { status: 201 });
    setClaimCookie(response, result.cookie);
    return response;
  }

  const [status, code, message] = OPEN_CLAIM_ERROR_MAP[result.status];
  return v2Error(code, message, status);
}
