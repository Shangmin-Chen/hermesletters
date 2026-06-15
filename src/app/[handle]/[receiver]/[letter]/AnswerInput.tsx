"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Seconds to lock the input after a 429, to stop mashing before retrying.
const RATE_LIMIT_COOLDOWN_SECONDS = 5;

interface AnswerInputProps {
  letterId: string;
  answerShape: string;
}

type VerifyStatus =
  | "idle"
  | "loading"
  | "unlocked"
  | "incorrect"
  | "already_opened"
  | "expired"
  | "rate_limited"
  | "error";

/**
 * Underline answer input derived from the letter's answer_shape.
 *
 * answer_shape convention (from Phase 4 / SPEC):
 *   - every non-space character → "_"  (one underline slot)
 *   - space characters → " "           (blank gap between words)
 *
 * We render a single accessible <input> for the guess but visually lay out
 * underline slots matching the shape. The full typed string is submitted.
 */
export function AnswerInput({ letterId, answerShape }: AnswerInputProps) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [cooldown, setCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // After a 429, count the cooldown down to 0 (one tick/second), then auto
  // re-enable by clearing the rate_limited status.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => {
      setCooldown((c) => {
        const next = c - 1;
        if (next <= 0) {
          setStatus((s) => (s === "rate_limited" ? "idle" : s));
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Total number of non-space characters = total underline slots
  const totalChars = answerShape.replace(/ /g, "").length;
  // Past ~16 slots the full-width underscores become a wall on a phone; switch
  // to compact ticks so the decorative shape stays calm and wraps gracefully.
  const isCompactShape = totalChars > 16;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || isPending) return;

    setStatus("loading");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/letters/${letterId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guess }),
        });

        if (res.status === 429) {
          setStatus("rate_limited");
          setCooldown(RATE_LIMIT_COOLDOWN_SECONDS);
          return;
        }

        const data = (await res.json()) as { status: string };

        if (data.status === "unlocked") {
          // Set terminal state BEFORE triggering refresh so the input and button
          // stay disabled through the re-render, preventing a second POST.
          setStatus("unlocked");
          // One-shot "this open just happened" flag, read once by RevealOnce on
          // the next server render so the envelope-chrome reveal plays exactly
          // once. Set BEFORE router.refresh() so it's present when the refreshed
          // UnsealedView mounts; RevealOnce clears it so a later reload within
          // the grace window shows the letter instantly (no re-animation).
          // Additive — must run alongside (not replace) the setStatus guard above.
          try {
            sessionStorage.setItem(`just-opened:${letterId}`, "1");
          } catch {
            // sessionStorage can throw (private mode / disabled storage);
            // a missing flag just means the reveal renders its final state.
          }
          // Cookie is now set server-side; reload so the Server Component
          // re-renders the unsealed letter using the claim cookie.
          router.refresh();
          return;
        }

        if (data.status === "incorrect") {
          setStatus("incorrect");
          // Keep the typed text and select it all, so a near-miss can be edited
          // or overtyped instead of forcing a fresh start.
          inputRef.current?.focus();
          inputRef.current?.select();
          return;
        }

        if (data.status === "already_opened") {
          setStatus("already_opened");
          return;
        }

        if (data.status === "expired") {
          setStatus("expired");
          return;
        }

        setStatus("error");
      } catch {
        setStatus("error");
      }
    });
  }

  const statusMessage: Record<Exclude<VerifyStatus, "idle" | "loading" | "unlocked">, string> = {
    incorrect: "Hmm, not it — no rush, give it another think.",
    already_opened: "Someone's already opened this one.",
    expired: "This letter has slipped away.",
    rate_limited: "Let's slow down a moment — try again shortly.",
    error: "Something went wrong. Please try again.",
  };

  const isErrorStatus =
    status === "incorrect" || status === "error" || status === "rate_limited";

  // already_opened and expired are terminal dead-ends — surface an exit instead
  // of a silently disabled input.
  const isTerminalStatus = status === "already_opened" || status === "expired";

  const isCoolingDown = status === "rate_limited" && cooldown > 0;

  const isDisabled =
    isPending ||
    status === "loading" ||
    status === "unlocked" ||
    isCoolingDown ||
    isTerminalStatus;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/*
       * Decorative underline slots derived from answer_shape.
       *
       * The placeholder "(N characters)" is the canonical length signal; these
       * slots are purely decorative (aria-hidden) so we condense them for long
       * answers instead of producing a wall of underscores on a phone:
       *   - short answers (≤16 chars): full-size slots, word gaps preserved.
       *   - long answers (>16 chars): compact, narrower ticks that wrap calmly.
       */}
      <div
        aria-hidden="true"
        className={[
          "flex flex-wrap mb-4 justify-center select-none",
          isCompactShape ? "gap-x-2 gap-y-1" : "gap-x-3 gap-y-1",
        ].join(" ")}
      >
        {/* Render word-by-word so spaces create visible gaps */}
        {answerShape.split(" ").map((word, wi) => (
          <span key={wi} className={isCompactShape ? "flex gap-0.5" : "flex gap-1"}>
            {word.split("").map((ch, ci) =>
              ch === "_" ? (
                <span
                  key={ci}
                  className={[
                    "inline-block border-b-2 border-wax/60",
                    isCompactShape ? "h-4 w-1.5" : "h-6 w-4",
                  ].join(" ")}
                />
              ) : null
            )}
          </span>
        ))}
      </div>

      {/* Accessible single input — screen reader sees this */}
      <div className="flex flex-col items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          aria-label="Your answer"
          placeholder={`Your answer (${totalChars} character${totalChars === 1 ? "" : "s"})`}
          value={guess}
          onChange={(e) => {
            setGuess(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          disabled={isDisabled}
          autoComplete="off"
          spellCheck={false}
          className={[
            "w-full max-w-xs rounded-lg border bg-background px-4 py-2.5",
            "text-center text-sm font-sans text-foreground placeholder:text-muted-foreground",
            "shadow-sm transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
            isErrorStatus
              ? "border-destructive/70 focus-visible:ring-destructive/50"
              : "border-border",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        />

        {/* Terminal dead-ends (already opened / expired): clear messaging plus a
            way out, mirroring the SealedView tone — not a silently dead input. */}
        {isTerminalStatus ? (
          <div role="alert" className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">{statusMessage[status]}</p>
            <Link
              href="/"
              className="text-sm text-muted-foreground underline hover:text-foreground transition-colors min-h-[44px] inline-flex items-center justify-center"
            >
              Back home
            </Link>
          </div>
        ) : (
          status !== "idle" &&
          status !== "loading" &&
          status !== "unlocked" && (
            <p
              role="alert"
              className={[
                "text-sm text-center",
                isErrorStatus ? "text-destructive" : "text-muted-foreground",
              ].join(" ")}
            >
              {isErrorStatus && (
                <span aria-hidden="true" className="mr-1">✕</span>
              )}
              {status === "rate_limited" && cooldown > 0
                ? `Let's slow down a moment — try again in ${cooldown}s.`
                : statusMessage[status]}
            </p>
          )
        )}

        {/* At a terminal dead-end the action no longer applies — the "Back home"
            link above is the only affordance, so we omit the submit button. */}
        {!isTerminalStatus && (
          <button
            type="submit"
            disabled={!guess.trim() || isDisabled}
            className={[
              "relative rounded-full px-6 py-2.5 text-sm font-medium font-sans",
              "bg-primary text-primary-foreground shadow-sm",
              "transition-all duration-150",
              "hover:bg-wax-deep hover:shadow-md active:scale-[0.97]",
              // Match the ring offset to the page background so the gap reads
              // correctly regardless of the surrounding card/footer tint.
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100",
            ].join(" ")}
          >
            {status === "unlocked"
              ? "Opening…"
              : isPending || status === "loading"
              ? "One sec…"
              : status === "rate_limited" && cooldown > 0
              ? `Try again in ${cooldown}s`
              : "Open it"}
          </button>
        )}
      </div>
    </form>
  );
}
