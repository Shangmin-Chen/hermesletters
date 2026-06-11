import "server-only";

// This page reads cookies and makes DB queries at request time — never statically generated.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { adminClient } from "@/lib/supabase/admin";
import { getUser, getProfile } from "@/lib/auth";
import Link from "next/link";
import { AnswerInput } from "./AnswerInput";
import { KeepButton } from "./KeepButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{
    handle: string;
    receiver: string;
    letter: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mint a signed URL for a storage path (private "letters" bucket).
 * Expires in 1 hour (grace window is 24h; short-lived URLs are safer).
 */
async function mintSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await adminClient.storage
    .from("letters")
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LetterPage({ params }: PageProps) {
  const { handle, receiver, letter: letterParam } = await params;
  const letterPath = `/${handle}/${receiver}/${letterParam}`;

  // ── Fetch the letter by URL triple (server-side Drizzle, bypasses RLS) ────
  //
  // SECURITY: We fetch ALL columns here so we can perform the cookie/expiry
  // check, but we ONLY pass body / answerNormalized / images to the render
  // tree in the validated grace branch. In all other branches those fields
  // never reach the client.
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
    return <SealedView message="This letter has already been saved and is no longer viewable here." />;
  }

  // 2. expired by DB status or by read-time guard
  if (row.status === "expired" || isExpiredByTime) {
    return <SealedView message="This letter has expired." />;
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

      // Mint signed URLs server-side (never expose storage paths to client)
      const signedUrls = await Promise.all(
        imageRows.map((img) => mintSignedUrl(img.storagePath))
      );
      const validUrls = signedUrls.filter((u): u is string => u !== null);

      // Determine auth state for the keep-flow UI (server-side, no body leakage)
      const [graceUser, graceProfile] = await Promise.all([
        getUser(),
        getProfile(),
      ]);
      const isLoggedIn = graceUser !== null;
      const hasProfile = graceProfile !== null;

      return (
        <UnsealedView
          body={row.body}
          imageUrls={validUrls}
          letterId={row.id}
          expiresAt={row.expiresAt!}
          isLoggedIn={isLoggedIn}
          hasProfile={hasProfile}
          letterPath={letterPath}
        />
      );
    }

    // Cookie present but doesn't match, OR no cookie at all → sealed
    return <SealedView message="This letter has already been opened." />;
  }

  // 4. unopened — show the locked page (question + answer_shape only)
  if (row.status === "unopened") {
    return (
      <LockedView
        letterId={row.id}
        question={row.question}
        answerShape={row.answerShape}
      />
    );
  }

  // Fallback — shouldn't happen with a complete enum, but be safe
  return <SealedView message="This letter is unavailable." />;
}

// ---------------------------------------------------------------------------
// Sub-views (all Server Components — no client code unless explicitly marked)
// ---------------------------------------------------------------------------

// ── Locked view (unopened) ────────────────────────────────────────────────

function LockedView({
  letterId,
  question,
  answerShape,
}: {
  letterId: string;
  question: string;
  answerShape: string;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">
        {/* Envelope shape */}
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {/* Envelope flap */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Letter">
              ✉
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Sealed Letter
            </p>
          </div>

          {/* Lock area */}
          <div className="px-6 py-8 flex flex-col items-center gap-6">
            {/* Lock icon */}
            <div className="rounded-full bg-neutral-100 p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-neutral-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            {/* Security question */}
            <div className="text-center">
              <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-2">
                Security Question
              </p>
              <p className="text-base font-medium text-neutral-800">{question}</p>
            </div>

            {/* Underline input (client component — only receives safe fields) */}
            <div className="w-full">
              <AnswerInput letterId={letterId} answerShape={answerShape} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Unsealed view (grace window, cookie validated) ────────────────────────

function UnsealedView({
  body,
  imageUrls,
  letterId,
  expiresAt,
  isLoggedIn,
  hasProfile,
  letterPath,
}: {
  body: string;
  imageUrls: string[];
  letterId: string;
  expiresAt: Date;
  isLoggedIn: boolean;
  hasProfile: boolean;
  letterPath: string;
}) {
  const expiresFormatted = expiresAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {/* Open envelope top */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Open letter">
              📨
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Your Letter
            </p>
          </div>

          {/* Letter body */}
          <div className="px-6 py-8">
            {/*
             * body is plain text; React escapes it by default.
             * We split on newlines to preserve line breaks without
             * dangerouslySetInnerHTML.
             */}
            <div className="text-neutral-800 text-base leading-relaxed whitespace-pre-wrap font-[var(--font-geist-sans)]">
              {body.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {"\n"}
                </span>
              ))}
            </div>

            {/* Image gallery */}
            {imageUrls.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {imageUrls.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={url}
                    alt={`Image ${i + 1}`}
                    className="w-full rounded-lg border border-neutral-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Expiry + save notice — keep-flow branching */}
          <div className="border-t border-neutral-100 bg-amber-50 px-6 py-4 flex flex-col gap-3">
            <p className="text-sm text-amber-800">
              This letter will vanish on <strong>{expiresFormatted}</strong>.{" "}
              Saving it to your account makes it permanent.
            </p>

            {/* Branch 1: logged in + has profile → show the Keep button */}
            {isLoggedIn && hasProfile && (
              <KeepButton letterId={letterId} letterPath={letterPath} />
            )}

            {/* Branch 2: logged in but no profile → must complete onboarding first */}
            {isLoggedIn && !hasProfile && (
              <p className="text-sm text-amber-800">
                You need a handle before you can keep letters.{" "}
                <Link
                  href="/onboarding"
                  className="underline font-medium hover:text-amber-900"
                >
                  Complete onboarding
                </Link>
                , then return here and click &ldquo;Keep this letter.&rdquo;
              </p>
            )}

            {/* Branch 3: not logged in → link to login with next= so they return here */}
            {!isLoggedIn && (
              <p className="text-sm text-amber-800">
                <Link
                  href={`/login?next=${encodeURIComponent(letterPath)}`}
                  className="underline font-medium hover:text-amber-900"
                >
                  Log in to keep it
                </Link>{" "}
                — your progress is preserved while you sign in.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Sealed / closed views (already opened, expired, saved) ────────────────

function SealedView({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {/* Sealed envelope top */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Sealed">
              🔒
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Sealed
            </p>
          </div>

          <div className="px-6 py-10 text-center">
            <p className="text-neutral-600 text-base">{message}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
