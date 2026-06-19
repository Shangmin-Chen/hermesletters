import "server-only";
import { requireProfile } from "@/lib/auth";
import { db } from "@/db";
import { letters, profiles } from "@/db/schema";
import { eq, and, isNotNull, ne, inArray, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PhonebookPage() {
  const profile = await requireProfile();
  const userId = profile.id;

  // ── Connection query (READ-MODEL only — no table created) ─────────────────
  //
  // A "connection" is someone with whom the current user has exchanged a
  // kept letter in either direction:
  //   Leg A — senders whose letters I kept:
  //            letters.saved_by = me AND letters.saved_at IS NOT NULL AND letters.sender_id != me
  //   Leg B — recipients who kept letters I sent:
  //            letters.sender_id = me AND letters.saved_by IS NOT NULL AND letters.saved_by != me
  //
  // Only safe profile fields are selected (id, handle, display_name).
  // No body, question, answer, or claim_token is ever read.

  // Leg A: sender IDs of letters I kept, with count
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

  // Leg B: saved_by IDs of letters I sent that were kept, with count
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

  // Union and de-duplicate, accumulating letter counts per partner
  const countMap = new Map<string, number>();
  for (const row of legA) {
    if (row.partnerId) {
      countMap.set(
        row.partnerId,
        (countMap.get(row.partnerId) ?? 0) + Number(row.count)
      );
    }
  }
  for (const row of legB) {
    if (row.partnerId) {
      countMap.set(
        row.partnerId,
        (countMap.get(row.partnerId) ?? 0) + Number(row.count)
      );
    }
  }

  const connectedIds = Array.from(countMap.keys());

  type Connection = {
    id: string;
    handle: string;
    displayName: string | null;
    sharedLetterCount: number;
  };

  let connections: Connection[] = [];

  if (connectedIds.length > 0) {
    // Fetch safe profile fields only — no letter body, answer, or claim_token
    const connectedProfiles = await db
      .select({
        id: profiles.id,
        handle: profiles.handle,
        displayName: profiles.displayName,
      })
      .from(profiles)
      .where(inArray(profiles.id, connectedIds));

    connections = connectedProfiles.map((p) => ({
      ...p,
      sharedLetterCount: countMap.get(p.id) ?? 0,
    }));

    // Sort alphabetically by handle
    connections.sort((a, b) => a.handle.localeCompare(b.handle));
  }

  return (
    <main className="flex flex-1 flex-col items-center p-4 pt-10 sm:p-6">
      <div className="w-full max-w-2xl space-y-6 animate-rise-in">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-serif text-xl">Phonebook</CardTitle>
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {connections.length}
              </span>
            </div>
            <CardDescription>
              People you&apos;ve exchanged kept letters with.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connections yet — they appear once you&apos;ve exchanged a
                kept letter.
              </p>
            ) : (
              <ul className="divide-y">
                {connections.map((conn) => (
                  <li
                    key={conn.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div>
                      <p className="font-medium">@{conn.handle}</p>
                      {conn.displayName && (
                        <p className="text-sm text-muted-foreground">
                          {conn.displayName}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {conn.sharedLetterCount}{" "}
                      {conn.sharedLetterCount === 1 ? "shared letter" : "shared letters"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
