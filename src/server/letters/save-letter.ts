import "server-only";

import type { NextRequest } from "next/server";
import { and, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { claimCookieName, readClaimCookie } from "./claim-cookie";
import { type LetterLookup, resolveLetterId } from "./letter-lookup";

export type SaveLetterResult = { status: "saved" | "cannot_save" };

export async function saveLetterForProfile({
  lookup,
  request,
  userId,
  profileId,
}: {
  lookup: LetterLookup;
  request: NextRequest;
  userId: string;
  profileId: string;
}): Promise<SaveLetterResult> {
  const letterId = await resolveLetterId(lookup);
  if (!letterId) return { status: "cannot_save" };

  const cookieValue = readClaimCookie(request, claimCookieName(letterId));
  const ownershipGate = cookieValue
    ? or(eq(letters.claimToken, cookieValue), eq(letters.receiverId, profileId))
    : eq(letters.receiverId, profileId);

  const updated = await db
    .update(letters)
    .set({
      savedBy: userId,
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

  return { status: updated.length > 0 ? "saved" : "cannot_save" };
}
