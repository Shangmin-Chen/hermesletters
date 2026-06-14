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
import { Envelope } from "@/components/brand/Envelope";
import { AnswerInput } from "./AnswerInput";
import { RevealOnce } from "./RevealOnce";
import { KeepButton } from "./KeepButton";
import { LocalDateTime } from "@/components/LocalDateTime";
import { Countdown } from "./Countdown";

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

/**
 * Title-case a receiver slug for the greeting.
 *
 * Blunt CSS `capitalize` mangles real names — it lowercases interior letters
 * and only uppercases the first letter of each space-separated chunk, so
 * "o-brien" → "O Brien" and "mcdonald" → "Mcdonald". This handles slugs more
 * gracefully: it splits on spaces AND hyphens (preserving hyphens), capitalizes
 * each part, and applies a couple of common Anglo-Irish/Scots name patterns
 * (O'Brien, McDonald, MacLeod) that readers expect to see.
 *
 * Stays safe for arbitrary slugs — anything it doesn't recognize just gets
 * first-letter capitalization.
 */
function titleCaseName(slug: string): string {
  const cap = (w: string) =>
    w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase();

  const stylizeWord = (word: string): string => {
    const lower = word.toLowerCase();

    // O'brien / obrien → O'Brien
    if (/^o'?[a-z]{2,}$/.test(lower)) {
      const rest = lower.replace(/^o'?/, "");
      return `O'${cap(rest)}`;
    }
    // mcdonald → McDonald
    if (/^mc[a-z]{2,}$/.test(lower)) {
      return `Mc${cap(lower.slice(2))}`;
    }
    // macleod → MacLeod (avoid short words like "mac" itself)
    if (/^mac[a-z]{3,}$/.test(lower)) {
      return `Mac${cap(lower.slice(3))}`;
    }
    return cap(word);
  };

  return slug
    .split(" ")
    .map((chunk) =>
      // Preserve hyphens between parts while casing each part.
      chunk.split("-").map(stylizeWord).join("-")
    )
    .join(" ");
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
    return <SealedView message="This letter has already been opened — it found its person." />;
  }

  // 4. unopened — show the locked page (question + answer_shape only)
  if (row.status === "unopened") {
    return (
      <LockedView
        letterId={row.id}
        question={row.question}
        answerShape={row.answerShape}
        senderHandle={row.senderHandle}
        receiverName={receiver}
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
  senderHandle,
  receiverName,
}: {
  letterId: string;
  question: string;
  answerShape: string;
  senderHandle: string;
  receiverName: string;
}) {
  // receiverName is a slug ("maya-lin"); title-case it for the greeting.
  const receiverDisplay = titleCaseName(receiverName);

  return (
    // The whole scene sits on the desk — the atmosphere layer (body::before sun
    // pour / candle pool) reads as the surface. We drop the boxy card: the
    // sealed envelope rests directly on the desk, with the prompt below it.
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-rise-in flex flex-col items-center text-center">

        {/* Sealed envelope on the desk — wax seal breathing (idle pulse) */}
        <div className="animate-wax-pulse drop-shadow-[0_8px_24px_oklch(0_0_0/0.18)]">
          <Envelope state="sealed" className="w-24 h-24 text-ink" aria-hidden />
        </div>

        {/* Greeting */}
        <div className="mt-6">
          <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug tracking-tight">
            {receiverDisplay}, you have a letter.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            from{" "}
            <span className="font-mono text-foreground/80">@{senderHandle}</span>
          </p>
        </div>

        {/* The shared-secret prompt — sits on a faint paper inset so it reads as
            a note pinned to the envelope, not a UI panel. */}
        <div className="mt-8 w-full rounded-2xl border border-border/70 bg-card/70 px-6 py-7 shadow-sm flex flex-col items-center gap-6">
          <div className="space-y-2">
            <p className="text-xs text-wax uppercase tracking-[0.18em] font-medium">
              Something only the two of you know
            </p>
            <p className="font-serif text-lg text-foreground leading-relaxed">
              {question}
            </p>
          </div>

          {/* Underline input (client component — only receives safe fields) */}
          <div className="w-full">
            <AnswerInput letterId={letterId} answerShape={answerShape} />
          </div>
        </div>

        {/* Subtle footer hint */}
        <p className="mt-5 text-xs text-muted-foreground">
          The letter opens once — for the person it was written to.
        </p>
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
  // ── Envelope CHROME (the only animated element) ──────────────────────────
  //
  // This is server-rendered JSX handed to RevealOnce as its `chrome` slot. At
  // rest it shows the open envelope; while RevealOnce sets data-reveal="playing"
  // the .reveal-seal / .reveal-flap beats run (overlapping, ≤~800ms). It carries
  // NO letter content — only the open-envelope header + greeting.
  const chrome = (
    <div className="text-center flex flex-col items-center gap-3 pb-8">
      {/*
       * Reveal beats: the seal cracks (.reveal-seal) while the flap swings open
       * (.reveal-flap) — overlapped so the "it's really you" moment lands fast.
       * Keyframes + the data-reveal gate live in globals.css. At rest (the
       * SSR/initial state) this simply renders the open envelope, motionless.
       */}
      <div style={{ perspective: "600px" }}>
        <div className="reveal-seal">
          <div className="reveal-flap">
            <Envelope state="open" className="w-24 h-24 text-ink" aria-hidden />
          </div>
        </div>
      </div>
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug tracking-tight">
          It&rsquo;s really you.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&rsquo;s your letter.
        </p>
      </div>
    </div>
  );

  return (
    // Letter-on-paper: the body lives on an actual sheet (bg-card, paper tooth
    // via the global [data-slot=card] grain), resting on the desk — far less
    // "UI card" than the old bordered panel with a tinted header strip.
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl animate-rise-in">
        {/*
         * RevealOnce wraps the server-rendered children WITHOUT receiving `body`
         * as a prop. The chrome (header) animates; everything below — the body,
         * gallery, expiry footer, and ALL keep-flow branches — is passed as React
         * `children`, server-rendered and readable from frame one (no
         * animate-unfold). RevealOnce never re-fetches and never re-renders body.
         */}
        <RevealOnce letterId={letterId} chrome={chrome}>
          {/* The letter sheet itself */}
          <div
            data-slot="card"
            className="rounded-2xl border border-border/70 bg-card shadow-md px-7 py-9 sm:px-10 sm:py-11"
          >
            {/*
             * body is plain text; React escapes it by default.
             * whitespace-pre-wrap preserves newlines without split/map
             * (which would inject double newlines). Rendered at opacity 1 —
             * the body must be readable the instant the page paints.
             */}
            <div className="font-serif text-foreground text-base leading-[1.85] tracking-[0.01em] whitespace-pre-wrap">
              {body}
            </div>

            {/* Image gallery */}
            {imageUrls.length > 0 && (
              <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {imageUrls.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={url}
                    alt={`Image ${i + 1}`}
                    className="w-full rounded-xl border border-border object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Expiry + keep-flow footer — sits on the desk below the sheet. */}
          <div className="mt-5 rounded-2xl border border-border/60 bg-muted/50 px-6 py-5 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This letter is yours until{" "}
              <strong className="text-foreground">
                <LocalDateTime date={expiresAt} />
              </strong>{" "}
              (<Countdown expiresAt={expiresAt} />).{" "}
              Keep it, and it stays with you for good.
            </p>

            {/* Branch 1: logged in + has profile → show the Keep button */}
            {isLoggedIn && hasProfile && (
              <KeepButton letterId={letterId} letterPath={letterPath} />
            )}

            {/* Branch 2: logged in but no profile → must complete onboarding first */}
            {isLoggedIn && !hasProfile && (
              <p className="text-sm text-muted-foreground">
                You need a handle before you can keep letters.{" "}
                <Link
                  href="/onboarding"
                  className="underline font-medium text-foreground hover:text-wax transition-colors"
                >
                  Finish setting up
                </Link>
                , then come back — your letter will be here.
              </p>
            )}

            {/* Branch 3: not logged in → offer both log in and sign up, each
                carrying next= so they land back here afterward */}
            {!isLoggedIn && (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={`/login?next=${encodeURIComponent(letterPath)}`}
                  className="underline font-medium text-foreground hover:text-wax transition-colors"
                >
                  Log in to keep it
                </Link>{" "}
                or{" "}
                <Link
                  href={`/signup?next=${encodeURIComponent(letterPath)}`}
                  className="underline font-medium text-foreground hover:text-wax transition-colors"
                >
                  sign up to keep it
                </Link>{" "}
                — your progress is preserved while you do.
              </p>
            )}
          </div>
        </RevealOnce>
      </div>
    </main>
  );
}

// ── Sealed / closed views (already opened, expired, saved) ────────────────

function SealedView({ message }: { message: string }) {
  return (
    // Envelope-on-desk: a quiet, sealed envelope resting on the surface with the
    // closing note beneath. No boxy card / tinted header strip.
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-rise-in flex flex-col items-center text-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <Envelope
            state="sealed"
            className="w-20 h-20 text-muted-foreground drop-shadow-[0_6px_18px_oklch(0_0_0/0.14)]"
            aria-hidden
          />
          <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] font-medium">
            Sealed
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <h1 className="font-serif text-base text-foreground leading-relaxed max-w-xs">
            {message}
          </h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
