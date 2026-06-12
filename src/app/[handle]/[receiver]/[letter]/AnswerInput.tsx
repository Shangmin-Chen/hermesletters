"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Total number of non-space characters = total underline slots
  const totalChars = answerShape.replace(/ /g, "").length;

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
          return;
        }

        const data = (await res.json()) as { status: string };

        if (data.status === "unlocked") {
          // Set terminal state BEFORE triggering refresh so the input and button
          // stay disabled through the re-render, preventing a second POST.
          setStatus("unlocked");
          // Cookie is now set server-side; reload so the Server Component
          // re-renders the unsealed letter using the claim cookie.
          router.refresh();
          return;
        }

        if (data.status === "incorrect") {
          setStatus("incorrect");
          setGuess("");
          inputRef.current?.focus();
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

  const isDisabled =
    isPending ||
    status === "loading" ||
    status === "unlocked" ||
    status === "already_opened" ||
    status === "expired";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Visual underline slots derived from answer_shape */}
      <div
        aria-hidden="true"
        className="flex flex-wrap gap-x-3 gap-y-1 mb-4 justify-center select-none"
      >
        {/* Render word-by-word so spaces create visible gaps */}
        {answerShape.split(" ").map((word, wi) => (
          <span key={wi} className="flex gap-1">
            {word.split("").map((ch, ci) =>
              ch === "_" ? (
                <span
                  key={ci}
                  className="inline-block h-6 w-4 border-b-2 border-wax/60"
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

        {status !== "idle" && status !== "loading" && status !== "unlocked" && (
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
            {statusMessage[status]}
          </p>
        )}

        <button
          type="submit"
          disabled={!guess.trim() || isDisabled}
          className={[
            "relative rounded-full px-6 py-2.5 text-sm font-medium font-sans",
            "bg-primary text-primary-foreground shadow-sm",
            "transition-all duration-150",
            "hover:bg-wax-deep hover:shadow-md active:scale-[0.97]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100",
          ].join(" ")}
        >
          {status === "unlocked"
            ? "Opening…"
            : isPending || status === "loading"
            ? "One sec…"
            : "Open it"}
        </button>
      </div>
    </form>
  );
}
