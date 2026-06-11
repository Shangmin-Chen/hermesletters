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
    incorrect: "Not quite — try again.",
    already_opened: "This letter has already been opened by someone else.",
    expired: "This letter has expired.",
    rate_limited: "Too many attempts. Please wait a moment and try again.",
    error: "Something went wrong. Please try again.",
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Visual underline slots derived from answer_shape */}
      <div
        aria-hidden="true"
        className="flex flex-wrap gap-x-3 gap-y-1 mb-3 justify-center select-none"
      >
        {/* Render word-by-word so spaces create visible gaps */}
        {answerShape.split(" ").map((word, wi) => (
          <span key={wi} className="flex gap-px">
            {word.split("").map((ch, ci) =>
              ch === "_" ? (
                <span
                  key={ci}
                  className="inline-block w-5 border-b-2 border-current opacity-60"
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
          placeholder={`Answer (${totalChars} character${totalChars === 1 ? "" : "s"})`}
          value={guess}
          onChange={(e) => {
            setGuess(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          disabled={
            isPending ||
            status === "loading" ||
            status === "unlocked" ||
            status === "already_opened" ||
            status === "expired"
          }
          autoComplete="off"
          spellCheck={false}
          className="w-full max-w-xs rounded-md border border-neutral-300 bg-white/80 px-3 py-2 text-center text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {status !== "idle" && status !== "loading" && status !== "unlocked" && (
          <p
            role="alert"
            className={`text-sm text-center ${
              status === "incorrect" || status === "error" || status === "rate_limited"
                ? "text-red-600"
                : "text-neutral-600"
            }`}
          >
            {statusMessage[status]}
          </p>
        )}

        <button
          type="submit"
          disabled={
            !guess.trim() ||
            isPending ||
            status === "loading" ||
            status === "unlocked" ||
            status === "already_opened" ||
            status === "expired"
          }
          className="rounded-md bg-neutral-800 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "unlocked" ? "Unlocking…" : isPending || status === "loading" ? "Checking…" : "Unlock"}
        </button>
      </div>
    </form>
  );
}
