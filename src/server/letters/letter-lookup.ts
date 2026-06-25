import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";

export type LetterLookup =
  | { kind: "id"; id: string }
  | { kind: "publicId"; publicId: string };

export function whereLetterLookup(lookup: LetterLookup) {
  return lookup.kind === "id"
    ? eq(letters.id, lookup.id)
    : eq(letters.publicId, lookup.publicId);
}

export async function resolveLetterId(lookup: LetterLookup): Promise<string | null> {
  if (lookup.kind === "id") return lookup.id;

  const [row] = await db
    .select({ id: letters.id })
    .from(letters)
    .where(eq(letters.publicId, lookup.publicId))
    .limit(1);

  return row?.id ?? null;
}
