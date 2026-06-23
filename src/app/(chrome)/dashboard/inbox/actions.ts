"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { requireProfile } from "@/lib/auth";
import { verifySecretAnswer } from "@/lib/letter-security";
import {
  profileVerifyActorKey,
  recordVerifyAttemptWithinLimits,
} from "@/lib/letter-verify-rate-limit";

export type OpenDirectLetterResult = {
  status: "opened" | "noop" | "incorrect" | "expired" | "rate_limited";
};

/**
 * Open a DIRECT letter from the recipient's inbox. The authenticated analogue of
 * the invite verify route — NO claim cookie, NO token, NO expiry. The session
 * identity is the only gate: an atomic guarded UPDATE flips status to 'opened'
 * only when the caller is the receiver and the letter is still unopened.
 */
export async function openDirectLetterAction(
  letterId: string,
  guess?: string
): Promise<OpenDirectLetterResult> {
  const profile = await requireProfile();

  const [row] = await db
    .select({
      id: letters.id,
      receiverId: letters.receiverId,
      status: letters.status,
      expiresAt: letters.expiresAt,
      savedBy: letters.savedBy,
      secretPrompt: letters.secretPrompt,
      secretAnswerHash: letters.secretAnswerHash,
      secretAnswerSalt: letters.secretAnswerSalt,
    })
    .from(letters)
    .where(eq(letters.id, letterId))
    .limit(1);

  if (!row || row.receiverId !== profile.id) {
    return { status: "noop" };
  }

  const now = new Date();
  const expiredByTime =
    row.status === "opened" &&
    row.expiresAt !== null &&
    row.savedBy === null &&
    now >= row.expiresAt;

  if (row.status === "expired" || expiredByTime) {
    return { status: "expired" };
  }

  if (row.status !== "unopened") {
    return { status: "noop" };
  }

  if (row.secretPrompt) {
    const rateLimit = await recordVerifyAttemptWithinLimits({
      letterId,
      actorKey: profileVerifyActorKey(profile.id),
    });

    if (!rateLimit.allowed) {
      return { status: "rate_limited" };
    }

    if (
      !guess ||
      !verifySecretAnswer(guess, row.secretAnswerSalt, row.secretAnswerHash)
    ) {
      return { status: "incorrect" };
    }
  }

  const updated = await db
    .update(letters)
    .set({
      status: "opened",
      openedAt: sql`now()`,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    })
    .where(
      and(
        eq(letters.id, letterId),
        eq(letters.receiverId, profile.id),
        eq(letters.status, "unopened")
      )
    )
    .returning({ id: letters.id });

  // Empty → already opened or not addressed to this user. Either way, neutral.
  return { status: updated.length > 0 ? "opened" : "noop" };
}
