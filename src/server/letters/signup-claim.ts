import "server-only";

import { cookies } from "next/headers";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { parseLetterPath, type ParsedLetterPath } from "@/lib/letter-path";

type SignupClaimCandidate = {
  id: string;
  claimToken: string | null;
  status: string;
  openedAt: Date | string | null;
  expiresAt: Date | string | null;
  savedBy: string | null;
};

const signupClaimSelection = {
  id: letters.id,
  claimToken: letters.claimToken,
  status: letters.status,
  openedAt: letters.openedAt,
  expiresAt: letters.expiresAt,
  savedBy: letters.savedBy,
};

async function signupClaimCandidates(
  letterCoords: ParsedLetterPath
): Promise<SignupClaimCandidate[]> {
  if (letterCoords.kind === "v2") {
    return db
      .select(signupClaimSelection)
      .from(letters)
      .where(eq(letters.publicId, letterCoords.publicId))
      .limit(1);
  }

  return db
    .select(signupClaimSelection)
    .from(letters)
    .where(
      and(
        eq(letters.senderHandle, letterCoords.handle),
        eq(letters.receiverName, letterCoords.receiver),
        eq(letters.letterName, letterCoords.letterName),
        eq(letters.status, "opened"),
        isNotNull(letters.openedAt),
        gt(letters.expiresAt, sql`now()`),
        isNull(letters.savedBy)
      )
    );
}

export async function hasSignupClaimForLetterPath(path: string): Promise<boolean> {
  const letterCoords = parseLetterPath(path);
  if (!letterCoords) return false;

  const rows = await signupClaimCandidates(letterCoords);
  if (rows.length === 0) return false;

  const cookieStore = await cookies();
  const now = new Date();

  return rows.some((row) => {
    const cookieValue = cookieStore.get(`claim:${row.id}`)?.value ?? null;

    return (
      cookieValue !== null &&
      cookieValue === row.claimToken &&
      row.status === "opened" &&
      row.openedAt !== null &&
      row.expiresAt !== null &&
      new Date(row.expiresAt) > now &&
      row.savedBy === null
    );
  });
}
