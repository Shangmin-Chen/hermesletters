"use server";

import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireProfile } from "@/lib/auth";

/**
 * Move the current user's connections-seen cursor forward to now(), clearing the
 * new-connection red dot. Idempotent and forward-only; only touches the own row.
 */
export async function dismissConnectionsBadge(): Promise<void> {
  const profile = await requireProfile();
  await db
    .update(profiles)
    .set({ connectionsSeenAt: sql`now()` })
    .where(eq(profiles.id, profile.id));
}
