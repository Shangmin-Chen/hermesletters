// ---------------------------------------------------------------------------
// Letter views — Locked / Unsealed / Sealed.
//
// UnsealedView and SealedView are pure presentational components: they render
// only from props and perform no data access, auth, or cookie checks. All
// security-sensitive gating lives in the LetterPage server component in
// `page.tsx`, which passes `body` + signed image URLs into UnsealedView ONLY
// inside the cookie-validated grace branch.
//
// LockedView is an interactive client component that owns the unlock network
// request: it renders the WaxUnseal gesture, POSTs to
// /api/letters/[id]/verify on commit, handles error states (expired /
// already-opened / network failure) with user-visible retry messages, and
// refreshes the router on success so the server component re-renders with the
// claim cookie in place.
// ---------------------------------------------------------------------------

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Envelope } from "@/components/brand/Envelope";
import { WaxUnseal } from "@/components/letter/WaxUnseal";
import { Button } from "@/components/ui/button";
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
  senderHandle,
  receiverName,
  secretPrompt,
  answerShape,
  openToken,
}: {
  letterId: string;
  senderHandle: string;
  receiverName: string;
  secretPrompt: string;
  answerShape: string;
  openToken: string;
}) {
  // receiverName is a slug ("maya-lin"); title-case it for the greeting.
  const receiverDisplay = titleCaseName(receiverName);

  const needsSecret = Boolean(secretPrompt);
  const [isPending, startTransition] = useTransition();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(!needsSecret);
  const [guess, setGuess] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalChars = answerShape.replace(/ /g, "").length;

  async function handleVerify(): Promise<boolean> {
    if (needsSecret && !guess.trim()) {
      setErrorMsg("Answer the private prompt first.");
      inputRef.current?.focus();
      return false;
    }

    setErrorMsg(null);
    setIsVerifying(true);

    try {
      const res = await fetch(`/api/letters/${letterId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: openToken, guess }),
      });

      if (res.status === 429) {
        setResetKey((k) => k + 1);
        setErrorMsg("Too many attempts. Please wait a moment and try again.");
        setIsVerifying(false);
        return false;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { status?: string };
        setResetKey((k) => k + 1);
        if (data.status === "expired") {
          setErrorMsg("This letter has slipped away.");
        } else if (data.status === "already_opened") {
          setErrorMsg("Someone has already opened this one.");
        } else if (data.status === "incorrect") {
          setGuess("");
          inputRef.current?.focus();
          setErrorMsg("Not quite — try again.");
        } else if (data.status === "invalid_link") {
          setErrorMsg("This letter needs its original sealed link.");
        } else {
          setErrorMsg("Something went wrong. Please try again.");
        }
        setIsVerifying(false);
        return false;
      }

      const data = (await res.json()) as { status: string };

      if (data.status === "unlocked") {
        try {
          sessionStorage.setItem(`just-opened:${letterId}`, "1");
        } catch {
          // sessionStorage unavailable
        }
        setIsVerifying(false);
        setIsVerified(true);
        return true;
      }

      if (data.status === "already_opened") {
        setErrorMsg("Someone has already opened this one.");
      } else if (data.status === "expired") {
        setErrorMsg("This letter has slipped away.");
      } else if (data.status === "incorrect") {
        setResetKey((k) => k + 1);
        setGuess("");
        inputRef.current?.focus();
        setErrorMsg("Not quite — try again.");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
      setIsVerifying(false);
      return false;
    } catch {
      setResetKey((k) => k + 1);
      setErrorMsg("Something went wrong. Please try again.");
      setIsVerifying(false);
      return false;
    }
  }

  function handleUnseal() {
    startTransition(async () => {
      if (!needsSecret) {
        const success = await handleVerify();
        if (!success) return;
      }
      router.refresh();
    });
  }

  return (
    // The whole scene sits on the desk — the atmosphere layer reads as the
    // surface. The sealed envelope rests directly on the desk with the
    // unseal gesture below it.
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-rise-in flex flex-col items-center text-center">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug tracking-tight">
            {receiverDisplay}, you have a letter.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            from{" "}
            <span className="font-mono text-foreground/80">@{senderHandle}</span>
          </p>
        </div>

        {/* Private prompt — the answer travels with the wax-unseal gesture */}
        {needsSecret && (
          <form
            className="mb-7 w-full rounded-2xl border border-border/60 bg-card/70 px-5 py-5 text-left shadow-sm"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isPending || isVerifying || isVerified) return;
              await handleVerify();
            }}
          >
            <p className="text-xs uppercase tracking-[0.18em] font-medium text-wax">
              Shared secret
            </p>
            <p className="mt-2 font-serif text-lg leading-snug text-foreground">
              {secretPrompt}
            </p>

            {answerShape && (
              <div
                aria-hidden="true"
                className="mt-4 flex flex-wrap gap-x-3 gap-y-1 select-none"
              >
                {answerShape.split(" ").map((word, wordIndex) => (
                  <span key={wordIndex} className="flex gap-px">
                    {word.split("").map((ch, charIndex) =>
                      ch === "_" ? (
                        <span
                          key={charIndex}
                          className="inline-block w-4 border-b-2 border-current opacity-60"
                        />
                      ) : null
                    )}
                  </span>
                ))}
              </div>
            )}

            <label
              htmlFor={`answer-${letterId}`}
              className="mt-4 block text-sm font-medium text-foreground"
            >
              Your answer
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                ref={inputRef}
                id={`answer-${letterId}`}
                value={guess}
                onChange={(event) => {
                  setGuess(event.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={isPending || isVerifying || isVerified}
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  totalChars > 0
                    ? `${totalChars} character${totalChars === 1 ? "" : "s"}`
                    : "Answer"
                }
                className="h-9 flex-1 rounded-md border border-input bg-background/70 px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
              <Button
                type="submit"
                disabled={isPending || isVerifying || isVerified || !guess.trim()}
                className="h-9 px-4 cursor-pointer"
              >
                {isVerifying ? "Checking…" : isVerified ? "Correct" : "Verify"}
              </Button>
            </div>
          </form>
        )}

        {/* Wax-unseal gesture — the recipient presses and holds to open */}
        <WaxUnseal
          onUnseal={handleUnseal}
          disabled={!isVerified || isPending || isVerifying}
          disabledHint={
            isPending || isVerifying
              ? "Verifying…"
              : !isVerified
                ? "Solve the prompt to break the seal"
                : undefined
          }
          resetKey={resetKey}
        />

        {/* Error feedback */}
        {errorMsg && (
          <p
            role="alert"
            className="mt-5 text-sm text-destructive text-center"
          >
            {errorMsg}
          </p>
        )}

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

                {/* Honest claim mechanics: the claim is bound to this browser via
                    an httpOnly cookie (see verify/route.ts), so it can't follow the
                    reader to incognito/another device, and lapses after 24h. */}
                <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">
                    Kept on this browser.
                  </strong>{" "}
                  This letter is open now, and only to you — on this specific
                  device and browser. The claim lives in a cookie here, so
                  opening it again elsewhere (another device, or a
                  private/incognito window) won&apos;t work, and clearing your
                  cookies loses it. You have 24 hours to keep it before it slips
                  away for good.
                </div>

                {/* Branch 1: logged in + has profile → show the Keep button */}
                {isLoggedIn && hasProfile && (
                  <KeepButton letterId={letterId} letterPath={letterPath} />
                )}

                {/* Branch 2: logged in but no profile → must complete onboarding first */}
                {isLoggedIn && !hasProfile && (
                  <p className="text-sm text-muted-foreground">
                    You need a handle before you can keep letters.{" "}
                    <Link
                      href={`/onboarding?next=${encodeURIComponent(letterPath)}`}
                      className="underline font-medium text-foreground hover:text-wax transition-colors"
                    >
                      Finish setting up
                    </Link>
                    , then come back — your letter will be here.
                  </p>
                )}

                {/* Branch 3: not logged in → this letter is their invite. Offer
                    both log in and sign up, each carrying next= so they land back
                    here afterward. Signup is gated server-side to letter recipients,
                    so keeping this letter is the only way to create an account. */}
                {!isLoggedIn && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      This letter is also your invitation to Hermes Letters
                      — keeping it creates your account.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <Link
                        href={`/signup?next=${encodeURIComponent(letterPath)}`}
                        className="underline font-medium text-foreground hover:text-wax transition-colors"
                      >
                        Sign up to keep it
                      </Link>{" "}
                      or{" "}
                      <Link
                        href={`/login?next=${encodeURIComponent(letterPath)}`}
                        className="underline font-medium text-foreground hover:text-wax transition-colors"
                      >
                        log in
                      </Link>{" "}
                      if you already have an account — your progress is preserved
                      while you do.
                    </p>
                  </>
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
