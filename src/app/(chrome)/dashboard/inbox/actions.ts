"use server";

import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { requireProfile } from "@/lib/auth";

export type OpenDirectLetterResult = { status: "opened" | "noop" };

/**
 * Open a DIRECT letter from the recipient's inbox. The authenticated analogue of
 * the invite verify route — NO claim cookie, NO token, NO expiry. The session
 * identity is the only gate: an atomic guarded UPDATE flips status to 'opened'
 * only when the caller is the receiver and the letter is still unopened.
 */
export async function openDirectLetterAction(
  letterId: string
): Promise<OpenDirectLetterResult> {
  const profile = await requireProfile();

  const updated = await db
    .update(letters)
    .set({ status: "opened", openedAt: sql`now()` })
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
