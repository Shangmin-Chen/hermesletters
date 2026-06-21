import "server-only";

// This page reads cookies and makes DB queries at request time — never statically generated.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { getUserAndProfile } from "@/lib/auth";
import { hashOpenToken } from "@/lib/letter-security";
import { mintLetterImageSignedUrls } from "@/lib/supabase/signed-urls";
import { zipFilter } from "@/lib/zip-filter";
import { LockedView, UnsealedView, SealedView } from "./letter-views";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{
    handle: string;
    receiver: string;
    letter: string;
  }>;
  searchParams: Promise<{ t?: string }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LetterPage({ params, searchParams }: PageProps) {
  const { handle, receiver, letter: letterParam } = await params;
  const { t: openToken } = await searchParams;
  const letterPath = `/${handle}/${receiver}/${letterParam}`;

  // ── Fetch the letter by URL triple (server-side Drizzle, bypasses RLS) ────
  //
  // SECURITY: We fetch ALL columns here so we can perform the cookie/expiry
  // check, but we ONLY pass body / images to the render tree in the validated
  // grace branch. In all other branches those fields never reach the client.
  const [row] = await db
    .select()
    .from(letters)
    .where(
      and(
        eq(letters.senderHandle, handle),
        eq(letters.receiverName, receiver),
        eq(letters.letterName, letterParam)
      )
    )
    .limit(1);

  if (!row) notFound();

  const now = new Date();

  // ── Read-time expiry guard (catches un-flipped rows before Phase 7 job) ──
  const isExpiredByTime =
    row.expiresAt !== null && row.savedBy === null && now >= row.expiresAt;

  // ── Determine effective state ─────────────────────────────────────────────

  // 1. saved (opened and saved_by is set) — visible only in Received mail (Phase 6).
  //    Also treat status='saved' AND saved_by=NULL as orphaned → inaccessible.
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
      // ── Validated grace render — ONLY branch where body/images are loaded ─
      // Fetch images ordered by position
      const imageRows = await db
        .select()
        .from(letterImages)
        .where(eq(letterImages.letterId, row.id))
        .orderBy(letterImages.position);

      // Mint signed URLs server-side (never expose storage paths to client).
      // Zip captions to rows BEFORE filtering so a failed URL mint drops its caption.
      const signedUrls = await mintLetterImageSignedUrls(
        imageRows.map((img) => img.storagePath)
      );
      const rowCaptions = imageRows.map((img) => img.caption ?? null);
      const { a: validUrls, b: imageCaptions } = zipFilter(
        signedUrls,
        rowCaptions,
        (url): url is string => url !== null
      );

      // Determine auth state for the keep-flow UI (server-side, no body leakage)
      const { user: graceUser, profile: graceProfile } =
        await getUserAndProfile();
      const isLoggedIn = graceUser !== null;
      const hasProfile = graceProfile !== null;

      return (
        <UnsealedView
          body={row.body}
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

    // Cookie present but doesn't match, OR no cookie at all → sealed
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
        receiverName={receiver}
        secretPrompt={row.secretPrompt ?? ""}
        answerShape={row.secretAnswerShape ?? ""}
        openToken={openToken}
      />
    );
  }

  // Fallback — shouldn't happen with a complete enum, but be safe
  return <SealedView message="This letter is unavailable." />;
}
