import "server-only";

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { getUserAndProfile } from "@/lib/auth";
import { hashOpenToken } from "@/lib/letter-security";
import { mintLetterImageSignedUrls } from "@/lib/supabase/signed-urls";
import { zipFilter } from "@/lib/zip-filter";
import { LockedView, UnsealedView, SealedView } from "@/app/[handle]/[receiver]/[letter]/letter-views";

export type LetterPageLookup =
  | { kind: "publicId"; publicId: string }
  | { kind: "legacy"; handle: string; receiver: string; letterName: string };

export async function renderLetterShared(lookup: LetterPageLookup, openToken?: string) {
  const whereClause = (() => {
    if (lookup.kind === "publicId") {
      return eq(letters.publicId, lookup.publicId);
    }

    const legacySlugClause = and(
      eq(letters.senderHandle, lookup.handle),
      eq(letters.receiverName, lookup.receiver),
      eq(letters.letterName, lookup.letterName)
    );

    return typeof openToken === "string" && openToken.length > 0
      ? and(legacySlugClause, eq(letters.openTokenHash, hashOpenToken(openToken)))
      : legacySlugClause;
  })();

  const letterPath =
    lookup.kind === "publicId"
      ? `/l/${lookup.publicId}`
      : `/${lookup.handle}/${lookup.receiver}/${lookup.letterName}`;

  const [row] = await db
    .select({
      id: letters.id,
      senderHandle: letters.senderHandle,
      receiverName: letters.receiverName,
      letterName: letters.letterName,
      status: letters.status,
      openedAt: letters.openedAt,
      claimToken: letters.claimToken,
      expiresAt: letters.expiresAt,
      savedBy: letters.savedBy,
      openTokenHash: letters.openTokenHash,
      secretPrompt: letters.secretPrompt,
      secretAnswerShape: letters.secretAnswerShape,
    })
    .from(letters)
    .where(whereClause)
    .limit(1);

  if (!row) notFound();

  const now = new Date();

  // ── Read-time expiry guard ─────────────────────────────────────────────
  const isExpiredByTime =
    row.expiresAt !== null && row.savedBy === null && now >= row.expiresAt;

  // 1. saved (opened and saved_by is set)
  if (row.status === "saved") {
    return <SealedView message="This letter has found its home — it's been kept by whoever opened it." />;
  }

  // 2. expired by DB status or by read-time guard
  if (row.status === "expired" || isExpiredByTime) {
    return <SealedView message="This letter has slipped away — its moment has passed." />;
  }

  // 3. opened (grace window still live) — check cookie
  if (row.status === "opened" && row.openedAt !== null) {
    const cookieStore = await cookies();
    const cookieName = `claim:${row.id}`;
    const cookieValue = cookieStore.get(cookieName)?.value ?? null;

    const cookieMatches =
      cookieValue !== null &&
      row.claimToken !== null &&
      cookieValue === row.claimToken;

    if (cookieMatches) {
      const [contentRow] = await db
        .select({ body: letters.body })
        .from(letters)
        .where(eq(letters.id, row.id))
        .limit(1);

      if (!contentRow) notFound();

      const imageRows = await db
        .select({
          storagePath: letterImages.storagePath,
          caption: letterImages.caption,
        })
        .from(letterImages)
        .where(eq(letterImages.letterId, row.id))
        .orderBy(letterImages.position);

      const signedUrls = await mintLetterImageSignedUrls(
        imageRows.map((img) => img.storagePath)
      );
      const rowCaptions = imageRows.map((img) => img.caption ?? null);
      const { a: validUrls, b: imageCaptions } = zipFilter(
        signedUrls,
        rowCaptions,
        (url): url is string => url !== null
      );

      const { user: graceUser, profile: graceProfile } =
        await getUserAndProfile();
      const isLoggedIn = graceUser !== null;
      const hasProfile = graceProfile !== null;

      return (
        <UnsealedView
          body={contentRow.body}
          imageUrls={validUrls}
          imageCaptions={imageCaptions}
          letterId={row.id}
          expiresAt={row.expiresAt!}
          isLoggedIn={isLoggedIn}
          hasProfile={hasProfile}
          letterPath={letterPath}
        />
      );
    }

    return <SealedView message="This letter has already been opened — it found its person." />;
  }

  // 4. unopened — show the wax-unseal gesture
  if (row.status === "unopened") {
    const tokenMatches =
      typeof openToken === "string" &&
      openToken.length > 0 &&
      row.openTokenHash !== null &&
      hashOpenToken(openToken) === row.openTokenHash;

    if (!tokenMatches) {
      return <SealedView message="This letter needs its original sealed link to open." />;
    }

    return (
      <LockedView
        letterId={row.id}
        senderHandle={row.senderHandle}
        receiverName={row.receiverName}
        secretPrompt={row.secretPrompt ?? ""}
        answerShape={row.secretAnswerShape ?? ""}
        openToken={openToken}
      />
    );
  }

  return <SealedView message="This letter is unavailable." />;
}
