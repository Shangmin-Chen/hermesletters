// ---------------------------------------------------------------------------
// Presentational letter views — Locked / Unsealed / Sealed.
//
// These are PURE view components: they render only from the props handed to
// them and perform NO data access, auth, or cookie checks. All of the
// security-sensitive gating (which row, which branch, whether `body`/images are
// loaded at all) lives in the LetterPage server component in `page.tsx`, which
// passes `body` + signed image URLs into UnsealedView ONLY inside the
// cookie-validated grace branch. Extracting these views changes none of that —
// it just lets the dev-only QA harness (`/dev/*`) render them with fixture
// props, with zero auth or database.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { Envelope } from "@/components/brand/Envelope";
import { AnswerInput } from "./AnswerInput";
import { RevealOnce } from "./RevealOnce";
import { KeepButton } from "./KeepButton";
import { LocalDateTime } from "@/components/LocalDateTime";
import { Countdown } from "./Countdown";
import { EnvelopeContents } from "@/components/letter/EnvelopeContents";

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

// ── Locked view (unopened) ────────────────────────────────────────────────

export function LockedView({
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

export function UnsealedView({
  body,
  imageUrls,
  imageCaptions,
  letterId,
  expiresAt,
  isLoggedIn,
  hasProfile,
  letterPath,
}: {
  body: string;
  imageUrls: string[];
  imageCaptions?: (string | null)[];
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
          The envelope&rsquo;s open — see what&rsquo;s inside.
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
         * RevealOnce animates only the chrome (the open-envelope header). Its
         * children — the EnvelopeContents lootbox (letter + photos) and the
         * keep-flow footer — are passed straight through; RevealOnce never
         * re-fetches them and only toggles a class on the chrome above.
         */}
        <RevealOnce letterId={letterId} chrome={chrome}>
          {/*
           * EnvelopeContents is the "lootbox": the letter and the photos are two
           * separate things you reach in and take out. It receives the body +
           * signed image URLs (only ever rendered inside this cookie-validated
           * grace branch) and the keep-flow footer below as a passthrough slot.
           */}
          <EnvelopeContents
            body={body}
            imageUrls={imageUrls}
            imageCaptions={imageCaptions}
            footer={
              /* Expiry + keep-flow footer — sits on the desk below the contents. */
              <div className="rounded-2xl border border-border/60 bg-muted/50 px-6 py-5 flex flex-col gap-3">
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
            }
          />
        </RevealOnce>
      </div>
    </main>
  );
}

// ── Sealed / closed views (already opened, expired, saved) ────────────────

export function SealedView({ message }: { message: string }) {
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
