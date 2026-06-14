"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ReviewSummary } from "./ReviewSummary";

/**
 * SealScene — scene 3 of the compose ritual: the wax moment (T3.3).
 *
 * The question + answer (show/hide; the answer is NEVER autosaved). The framing
 * stays intimate ("something only the two of you know") — deliberately NOT
 * reframed as a lock. Renders ReviewSummary above the real submit so the old
 * one-glance reviewability survives, and it doubles as the reduced-motion
 * "see everything before sealing" affordance.
 *
 * Presentational only: the question/answer inputs are rendered here but
 * controlled by the orchestrator and never unmount. The submit button is the
 * ONLY `type="submit"` in the whole form (step buttons are type="button"), so
 * the form's onSubmit draft-clear fires only on the real send.
 */

interface SealSceneProps {
  question: string;
  onQuestionChange: (value: string) => void;
  answer: string;
  onAnswerChange: (value: string) => void;
  showAnswer: boolean;
  onToggleShowAnswer: () => void;
  // For ReviewSummary.
  receiverName: string;
  letterName: string;
  body: string;
  onBack: () => void;
  isPending: boolean;
}

export function SealScene({
  question,
  onQuestionChange,
  answer,
  onAnswerChange,
  showAnswer,
  onToggleShowAnswer,
  receiverName,
  letterName,
  body,
  onBack,
  isPending,
}: SealSceneProps) {
  return (
    <div className="space-y-6">
      <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
        Only they can unlock this. Choose something only the two of you would
        know.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="question" className="text-sm font-medium text-foreground">
          A question only they&apos;ll know
        </Label>
        <Input
          id="question"
          name="question"
          placeholder="e.g. What did we name the stray cat?"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          disabled={isPending}
          className="transition-shadow focus-visible:ring-ring"
          aria-describedby="question-hint"
        />
        <p id="question-hint" className="text-xs text-muted-foreground">
          This is what they&apos;ll see on the locked page before they can read
          your letter.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="answer" className="text-sm font-medium text-foreground">
          The answer
        </Label>
        <div className="relative">
          <Input
            id="answer"
            name="answer"
            type={showAnswer ? "text" : "password"}
            placeholder="e.g. Biscuit"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            disabled={isPending}
            autoComplete="off"
            className="pr-10 transition-shadow focus-visible:ring-ring"
            aria-describedby="answer-hint"
          />
          <button
            type="button"
            onClick={onToggleShowAnswer}
            aria-label={showAnswer ? "Hide answer" : "Show answer"}
            aria-pressed={showAnswer}
            disabled={isPending}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-ink"
          >
            {showAnswer ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <p id="answer-hint" className="text-xs text-muted-foreground">
          Not case-sensitive. They see the shape of the answer (length &amp;
          spaces) — not the letters.
        </p>
      </div>

      {/* One-glance recap (also the reduced-motion review affordance). */}
      <ReviewSummary
        receiverName={receiverName}
        letterName={letterName}
        body={body}
        question={question}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          &larr; Back
        </button>
        {/* The ONLY submit in the form. */}
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-wax py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-wax-deep active:bg-wax-deep"
        >
          {isPending ? "Sealing your letter…" : "Seal & send"}
        </Button>
      </div>
    </div>
  );
}
