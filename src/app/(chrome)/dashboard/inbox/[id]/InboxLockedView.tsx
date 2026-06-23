"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WaxUnseal } from "@/components/letter/WaxUnseal";
import { openDirectLetterAction } from "../actions";
import { Button } from "@/components/ui/button";

/**
 * Recipient-side unseal for a DIRECT letter. Reuses the wax-unseal ceremony, but
 * the open is an authenticated server action (no claim cookie). On success the
 * server flips status → 'opened', starts the grace window, and we refresh to
 * render the content.
 */
export function InboxLockedView({
  letterId,
  senderHandle,
  secretPrompt,
  answerShape,
}: {
  letterId: string;
  senderHandle: string;
  secretPrompt: string | null;
  answerShape: string | null;
}) {
  const needsSecret = Boolean(secretPrompt);
  const [isPending, startTransition] = useTransition();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(!needsSecret);
  const [guess, setGuess] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalChars = (answerShape ?? "").replace(/ /g, "").length;

  async function handleVerify(): Promise<boolean> {
    if (needsSecret && !guess.trim()) {
      setErrorMsg("Answer the private prompt first.");
      inputRef.current?.focus();
      return false;
    }

    setErrorMsg(null);
    setIsVerifying(true);

    try {
      // Both "opened" (we flipped it) and "noop" (a concurrent open won) mean
      // the letter is now open — refresh to render it.
      const result = await openDirectLetterAction(letterId, guess);
      if (result.status === "opened" || result.status === "noop") {
        setIsVerifying(false);
        setIsVerified(true);
        return true;
      }

      setResetKey((k) => k + 1);
      if (result.status === "incorrect") {
        setGuess("");
        inputRef.current?.focus();
        setErrorMsg("Not quite — try again.");
      } else if (result.status === "rate_limited") {
        setErrorMsg("Too many attempts. Please wait a moment and try again.");
      } else if (result.status === "expired") {
        setErrorMsg("This letter has slipped away.");
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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center animate-rise-in">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-semibold leading-snug tracking-tight text-foreground">
            You have a letter.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            from{" "}
            <span className="font-mono text-foreground/80">@{senderHandle}</span>
          </p>
        </div>

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

        {errorMsg && (
          <p role="alert" className="mt-5 text-center text-sm text-destructive">
            {errorMsg}
          </p>
        )}
      </div>
    </main>
  );
}
