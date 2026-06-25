import "server-only";

import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { hashOpenToken, verifySecretAnswer } from "@/lib/letter-security";
import {
  inviteVerifyActorKey,
  recordVerifyAttemptWithinLimits,
} from "@/lib/letter-verify-rate-limit";
import {
  type ClaimCookie,
  CLAIM_COOKIE_MAX_AGE_SECONDS,
  claimCookieName,
  isHttpsRequest,
} from "./claim-cookie";
import { type LetterLookup, whereLetterLookup } from "./letter-lookup";

export type ClaimInviteLetterResult =
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "already_opened" }
  | { status: "invalid_link" }
  | { status: "rate_limited" }
  | { status: "incorrect" }
  | {
      status: "unlocked";
      cookie: ClaimCookie;
    };

export async function claimInviteLetter({
  lookup,
  token,
  guess,
  request,
}: {
  lookup: LetterLookup;
  token: string;
  guess: string;
  request: NextRequest;
}): Promise<ClaimInviteLetterResult> {
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
    .where(whereLetterLookup(lookup))
    .limit(1);

  if (!row) return { status: "not_found" };

  const now = new Date();
  const isExpiredByTime =
    row.expiresAt !== null && row.savedBy === null && now >= row.expiresAt;

  if (row.status === "expired" || isExpiredByTime) {
    return { status: "expired" };
  }

  if (row.status === "saved" || row.status === "opened") {
    return { status: "already_opened" };
  }

  if (!row.openTokenHash || hashOpenToken(token) !== row.openTokenHash) {
    return { status: "invalid_link" };
  }

  const rateLimit = await recordVerifyAttemptWithinLimits({
    letterId: row.id,
    actorKey: inviteVerifyActorKey(request),
  });

  if (!rateLimit.allowed) {
    return { status: "rate_limited" };
  }

  if (!verifySecretAnswer(guess, row.secretAnswerSalt, row.secretAnswerHash)) {
    return { status: "incorrect" };
  }

  const newClaimToken = crypto.randomUUID();
  const openedAt = now;
  const expiresAt = new Date(now.getTime() + CLAIM_COOKIE_MAX_AGE_SECONDS * 1000);

  const updated = await db
    .update(letters)
    .set({
      openedAt,
      claimToken: newClaimToken,
      expiresAt,
      status: "opened",
    })
    .where(and(eq(letters.id, row.id), isNull(letters.openedAt)))
    .returning({ claimToken: letters.claimToken });

  if (updated.length === 0) {
    return { status: "already_opened" };
  }

  const [{ claimToken }] = updated;

  return {
    status: "unlocked",
    cookie: {
      name: claimCookieName(row.id),
      value: claimToken ?? newClaimToken,
      secure: isHttpsRequest(request),
      maxAge: CLAIM_COOKIE_MAX_AGE_SECONDS,
    },
  };
}
