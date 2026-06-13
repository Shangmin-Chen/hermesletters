"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createLetterAction, type CreateLetterState } from "./actions";
import { slugify } from "@/lib/slugify";

interface NewLetterFormProps {
  senderHandle: string;
}

// ── Client-side image guardrails ──────────────────────────────────────────────
// Mirror (loosely) the server's allowlist so we can warn BEFORE submit. The
// server remains the source of truth (magic-byte validation); this is UX only.
const ACCEPTED_EXTENSIONS =
  ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";
const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
// Generous client-side ceiling — purely to catch obviously-too-large files
// early. The server enforces the real limits.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Draft autosave ────────────────────────────────────────────────────────────
// We persist only non-sensitive fields. The answer is NEVER stored.
const DRAFT_KEY = "send-a-letter:new-draft";

type Draft = {
  receiver_name?: string;
  letter_name?: string;
  body?: string;
  question?: string;
};

type SelectedImage = {
  file: File;
  url: string;
  warning: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.type && !ACCEPTED_MIME.has(file.type)) {
    return "Unsupported format — use PNG, JPEG, GIF, or WEBP.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Too large (${formatBytes(file.size)}) — keep photos under 10 MB.`;
  }
  return null;
}

export function NewLetterForm({ senderHandle }: NewLetterFormProps) {
  const [state, formAction, isPending] = useActionState<CreateLetterState, FormData>(
    createLetterAction,
    null
  );

  const [receiverSlug, setReceiverSlug] = useState("");
  const [letterSlug, setLetterSlug] = useState("");

  // Controlled values for the persisted fields (so we can restore drafts).
  const [receiverName, setReceiverName] = useState("");
  const [letterName, setLetterName] = useState("");
  const [body, setBody] = useState("");
  const [question, setQuestion] = useState("");

  // Image selection state (UX feedback only; the file input still submits).
  const [images, setImages] = useState<SelectedImage[]>([]);

  // Answer reveal toggle.
  const [showAnswer, setShowAnswer] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // ── Restore draft on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      // Restoring a persisted draft from localStorage is a one-time sync from an
      // external store that's only readable on the client — it must live in an
      // effect to avoid a hydration mismatch, so the synchronous setState here
      // is intentional.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draft.receiver_name) {
        setReceiverName(draft.receiver_name);
        setReceiverSlug(slugify(draft.receiver_name));
      }
      if (draft.letter_name) {
        setLetterName(draft.letter_name);
        setLetterSlug(slugify(draft.letter_name));
      }
      if (draft.body) setBody(draft.body);
      if (draft.question) setQuestion(draft.question);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Corrupt draft — ignore.
    }
  }, []);

  // ── Persist draft (debounced) — never includes the answer ───────────────────
  useEffect(() => {
    const hasContent = receiverName || letterName || body || question;
    const timeout = setTimeout(() => {
      try {
        if (!hasContent) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const draft: Draft = {
          receiver_name: receiverName,
          letter_name: letterName,
          body,
          question,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Storage unavailable (private mode / quota) — autosave is best-effort.
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [receiverName, letterName, body, question]);

  // ── On error: surface the banner so the user sees their draft is intact ─────
  useEffect(() => {
    if (state?.error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRef.current.focus();
    }
  }, [state]);

  // ── Revoke object URLs when the selection changes or on unmount ─────────────
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Revoke previous URLs before replacing.
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        warning: validateFile(file),
      }))
    );
  }

  function clearImages() {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const previewPath = (
    <>
      {`/${senderHandle}/`}
      {receiverSlug || <span className="text-muted-foreground/60">their-name</span>}
      {"/"}
      {letterSlug || <span className="text-muted-foreground/60">letter-name</span>}
    </>
  );

  const hasWarnings = images.some((img) => img.warning !== null);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Optimistically clear the draft — if the action errors and returns,
        // the controlled values are still in state so the user loses nothing,
        // and the autosave effect will re-persist them on the next tick.
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
      }}
      className="space-y-8"
    >
      {/* Error banner */}
      {state?.error && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
        >
          {state.error}
        </div>
      )}

      {/* ── Section: Who is this for? ── */}
      <section className="space-y-5">
        <h2 className="font-serif text-base font-semibold text-ink border-b border-border pb-2">
          Who is this for?
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="receiver_name" className="text-sm font-medium text-foreground">
            Their name
          </Label>
          <Input
            id="receiver_name"
            name="receiver_name"
            placeholder="e.g. Jane"
            value={receiverName}
            onChange={(e) => {
              setReceiverName(e.target.value);
              setReceiverSlug(slugify(e.target.value));
            }}
            required
            disabled={isPending}
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="receiver-hint"
          />
          <p id="receiver-hint" className="text-xs text-muted-foreground">
            Just a first name is enough — this shapes their link.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="letter_name" className="text-sm font-medium text-foreground">
            A name for this letter
          </Label>
          <Input
            id="letter_name"
            name="letter_name"
            placeholder="e.g. Summer 2025"
            value={letterName}
            onChange={(e) => {
              setLetterName(e.target.value);
              setLetterSlug(slugify(e.target.value));
            }}
            required
            disabled={isPending}
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="letter-name-hint"
          />
          <p id="letter-name-hint" className="text-xs text-muted-foreground">
            Think of it as a subject line — just for the URL.
          </p>
        </div>

        {/* Live URL preview */}
        <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Their link will be
          </p>
          <p
            id="url-preview"
            className="font-mono text-sm text-ink break-all"
            aria-live="polite"
            aria-label="Live URL preview"
          >
            {previewPath}
          </p>
        </div>
      </section>

      {/* ── Section: The letter ── */}
      <section className="space-y-5">
        <h2 className="font-serif text-base font-semibold text-ink border-b border-border pb-2">
          The letter
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="body" className="text-sm font-medium text-foreground">
            Write freely
          </Label>
          <Textarea
            id="body"
            name="body"
            placeholder="Dear Jane,&#10;&#10;I wanted you to know…"
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            disabled={isPending}
            className="resize-y focus-visible:ring-ring transition-shadow font-serif text-base leading-[1.85] px-4 py-3 placeholder:font-sans placeholder:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Saved as a draft on this device as you write — never the secret answer.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="images" className="text-sm font-medium text-foreground">
            Photos{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="images"
            name="images"
            type="file"
            multiple
            ref={fileInputRef}
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFilesChange}
            disabled={isPending}
            className="focus-visible:ring-ring file:text-sm file:font-medium file:text-foreground"
            aria-describedby="images-hint"
          />
          <p id="images-hint" className="text-xs text-muted-foreground">
            PNG, JPEG, GIF, or WEBP. They appear below the letter once it&apos;s unlocked.
          </p>

          {/* Selected-image feedback */}
          {images.length > 0 && (
            <div className="mt-3 space-y-3" aria-live="polite">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  {images.length} photo{images.length === 1 ? "" : "s"} selected
                </p>
                <button
                  type="button"
                  onClick={clearImages}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-ink transition-colors underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              </div>

              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <li
                    key={`${img.file.name}-${i}`}
                    className="space-y-1"
                  >
                    <div
                      className={`relative aspect-square overflow-hidden rounded-lg border ${
                        img.warning
                          ? "border-destructive/50"
                          : "border-border"
                      } bg-muted/40`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Preview of ${img.file.name}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground" title={img.file.name}>
                      {img.file.name}
                    </p>
                    {img.warning && (
                      <p className="text-[11px] text-destructive leading-snug">
                        {img.warning}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {hasWarnings && (
                <p className="text-xs text-destructive" role="alert">
                  Some photos may be rejected when you send — fix or remove them first.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section: The secret ── */}
      <section className="space-y-5">
        <h2 className="font-serif text-base font-semibold text-ink border-b border-border pb-2">
          The secret
        </h2>
        <p className="text-sm text-muted-foreground -mt-2 leading-relaxed">
          Only they can unlock this. Choose something only the two of you would know.
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
            onChange={(e) => setQuestion(e.target.value)}
            required
            disabled={isPending}
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="question-hint"
          />
          <p id="question-hint" className="text-xs text-muted-foreground">
            This is what they&apos;ll see on the locked page before they can read your letter.
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
              required
              disabled={isPending}
              autoComplete="off"
              className="focus-visible:ring-ring transition-shadow pr-10"
              aria-describedby="answer-hint"
            />
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              aria-label={showAnswer ? "Hide answer" : "Show answer"}
              aria-pressed={showAnswer}
              disabled={isPending}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-ink transition-colors"
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
            Not case-sensitive. They see the shape of the answer (length &amp; spaces) — not the letters.
          </p>
        </div>
      </section>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full bg-wax text-primary-foreground hover:bg-wax-deep active:bg-wax-deep transition-colors rounded-full py-2.5 text-sm font-medium shadow-sm"
        disabled={isPending}
      >
        {isPending ? "Sealing your letter…" : "Seal & send"}
      </Button>
    </form>
  );
}
