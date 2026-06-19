import "server-only";

import { db } from "@/db";
import { letters, profiles } from "@/db/schema";
import { and, eq, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

/**
 * Phonebook connections are a READ-MODEL derived from the `letters` table — there
 * is no connection/edge table. A "connection" between two users exists once they
 * have exchanged a KEPT letter in either direction:
 *   Leg A — senders whose letters I kept:
 *            saved_by = me AND saved_at IS NOT NULL AND sender_id != me
 *   Leg B — recipients who kept letters I sent:
 *            sender_id = me AND saved_by IS NOT NULL AND saved_at IS NOT NULL AND saved_by != me
 *
 * A connection's "established at" moment is exactly the kept letter's `saved_at`,
 * which powers the new-connection red dot (see hasUnseenConnections).
 *
 * These helpers only ever read safe profile fields (id, handle, display_name) —
 * never body, claim_token, or letter content.
 */

export type Connection = {
  id: string;
  handle: string;
  displayName: string | null;
  sharedLetterCount: number;
};

/** Full connection list for `userId`, sorted by handle. Used by the phonebook page. */
export async function getConnections(userId: string): Promise<Connection[]> {
  // Leg A: senders whose letters I kept, with count.
  const legA = await db
    .select({
      partnerId: letters.senderId,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(letters)
    .where(
      and(
        eq(letters.savedBy, userId),
        isNotNull(letters.savedAt),
        ne(letters.senderId, userId)
      )
    )
    .groupBy(letters.senderId);

  // Leg B: recipients who kept letters I sent, with count.
  const legB = await db
    .select({
      partnerId: letters.savedBy,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(letters)
    .where(
      and(
        eq(letters.senderId, userId),
        isNotNull(letters.savedBy),
        isNotNull(letters.savedAt),
        ne(letters.savedBy, userId)
      )
    )
    .groupBy(letters.savedBy);

  // Union and de-duplicate, accumulating letter counts per partner.
  const countMap = new Map<string, number>();
  for (const row of [...legA, ...legB]) {
    if (row.partnerId) {
      countMap.set(
        row.partnerId,
        (countMap.get(row.partnerId) ?? 0) + Number(row.count)
      );
    }
  }

  const connectedIds = Array.from(countMap.keys());
  if (connectedIds.length === 0) return [];

  const connectedProfiles = await db
    .select({
      id: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
    })
    .from(profiles)
    .where(inArray(profiles.id, connectedIds));

  return connectedProfiles
    .map((p) => ({ ...p, sharedLetterCount: countMap.get(p.id) ?? 0 }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

/**
 * Whether `userId` and `otherId` are connected (have a kept letter between them in
 * either direction). The authorization primitive for sending a direct letter —
 * NEVER trust a client-supplied recipient without this check.
 */
export async function areConnected(
  userId: string,
  otherId: string
): Promise<boolean> {
  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(letters)
    .where(
      or(
        // Leg A: a letter I kept that otherId sent me.
        and(
          eq(letters.savedBy, userId),
          isNotNull(letters.savedAt),
          eq(letters.senderId, otherId)
        ),
        // Leg B: a letter I sent that otherId kept.
        and(
          eq(letters.senderId, userId),
          eq(letters.savedBy, otherId),
          isNotNull(letters.savedAt)
        )
      )
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Whether `userId` has any connection established AFTER `seenAt` — i.e. a kept
 * letter edge (either direction) with saved_at newer than the user's last
 * phonebook visit. Powers the new-connection red dot. NULL seenAt = never
 * visited, so any existing connection counts as unseen.
 */
export async function hasUnseenConnections(
  userId: string,
  seenAt: Date | string | null
): Promise<boolean> {
  const since = seenAt ? new Date(seenAt) : new Date(0);

  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(letters)
    .where(
      or(
        // Leg A: a letter I kept (I'm the receiver side of the edge).
        and(
          eq(letters.savedBy, userId),
          isNotNull(letters.savedAt),
          ne(letters.senderId, userId),
          gt(letters.savedAt, since)
        ),
        // Leg B: a letter I sent that someone kept (I'm the sender side).
        and(
          eq(letters.senderId, userId),
          isNotNull(letters.savedBy),
          isNotNull(letters.savedAt),
          ne(letters.savedBy, userId),
          gt(letters.savedAt, since)
        )
      )
    )
    .limit(1);

  return rows.length > 0;
}
