"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { requireProfile } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Archive / restore a kept letter.
// ---------------------------------------------------------------------------
//
// Archiving is a reversible flag flip on `archived_at` — it removes a letter
// from the kept list without deleting the row, images, or Storage objects.
//
// Both actions use a single ownership-gated conditional UPDATE (no TOCTOU gap),
// mirroring the save route's pattern. The gate is orphan-safe (see
// dashboard/received/[id]/page.tsx): saved_by must equal the current profile AND
// saved_at must be non-null, so a row orphaned by a deleted profile (saved_by
// NULL) can never be touched. If no row matches, we return a generic result and
// reveal nothing about why.

export type ArchiveResult = { status: "archived" | "cannot_archive" };
export type RestoreResult = { status: "restored" | "cannot_restore" };

export async function archiveKeptLetterAction(
  letterId: string
): Promise<ArchiveResult> {
  const profile = await requireProfile();

  const updated = await db
    .update(letters)
    .set({ archivedAt: sql`now()` })
    .where(
      and(
        eq(letters.id, letterId),
        eq(letters.savedBy, profile.id),
        isNotNull(letters.savedAt),
        isNull(letters.archivedAt)
      )
    )
    .returning({ id: letters.id });

  if (updated.length === 0) {
    return { status: "cannot_archive" };
  }

  // Defensive cache invalidation — a no-op today since the dashboard (and the
  // received detail page) are force-dynamic; kept in case caching changes.
  revalidatePath("/dashboard");
  return { status: "archived" };
}

export async function restoreKeptLetterAction(
  letterId: string
): Promise<RestoreResult> {
  const profile = await requireProfile();

  const updated = await db
    .update(letters)
    .set({ archivedAt: null })
    .where(
      and(
        eq(letters.id, letterId),
        eq(letters.savedBy, profile.id),
        isNotNull(letters.savedAt),
        isNotNull(letters.archivedAt)
      )
    )
    .returning({ id: letters.id });

  if (updated.length === 0) {
    return { status: "cannot_restore" };
  }

  // Defensive cache invalidation — a no-op today since the dashboard (and the
  // received detail page) are force-dynamic; kept in case caching changes.
  revalidatePath("/dashboard");
  return { status: "restored" };
}
