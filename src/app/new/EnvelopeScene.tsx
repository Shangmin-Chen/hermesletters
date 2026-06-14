"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * EnvelopeScene — scene 2 of the compose ritual: address the envelope (T3.2).
 *
 * Presentational only. The To (`receiver_name`) and label (`letter_name`) inputs
 * are rendered here but fully controlled by the orchestrator (they never
 * unmount; the scene only toggles `hidden`). "From @handle" is read-only.
 *
 * Back returns to the paper scene INSTANTLY — the orchestrator tears down the
 * FoldClone and restores the live textarea (with prior caret/scroll); there is
 * no reverse animation. The body stays editable throughout.
 */

interface EnvelopeSceneProps {
  senderHandle: string;
  receiverName: string;
  onReceiverNameChange: (value: string) => void;
  letterName: string;
  onLetterNameChange: (value: string) => void;
  /** Live URL preview node (built by the orchestrator from server-parity slugs). */
  urlPreview: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  isPending: boolean;
}

export function EnvelopeScene({
  senderHandle,
  receiverName,
  onReceiverNameChange,
  letterName,
  onLetterNameChange,
  urlPreview,
  onBack,
  onNext,
  isPending,
}: EnvelopeSceneProps) {
  return (
    <div className="space-y-6">
      <p className="-mt-1 text-sm leading-relaxed text-muted-foreground">
        Now address it. This is what their link will say.
      </p>

      <div className="space-y-1.5">
        <Label
          htmlFor="receiver_name"
          className="text-sm font-medium text-foreground"
        >
          To
        </Label>
        <Input
          id="receiver_name"
          name="receiver_name"
          placeholder="e.g. Jane"
          value={receiverName}
          onChange={(e) => onReceiverNameChange(e.target.value)}
          disabled={isPending}
          className="transition-shadow focus-visible:ring-ring"
          aria-describedby="receiver-hint"
        />
        <p id="receiver-hint" className="text-xs text-muted-foreground">
          Just a first name is enough — this shapes their link.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="letter_name"
          className="text-sm font-medium text-foreground"
        >
          A label for the envelope
        </Label>
        <Input
          id="letter_name"
          name="letter_name"
          placeholder="e.g. Summer 2025"
          value={letterName}
          onChange={(e) => onLetterNameChange(e.target.value)}
          disabled={isPending}
          className="transition-shadow focus-visible:ring-ring"
          aria-describedby="letter-name-hint"
        />
        <p id="letter-name-hint" className="text-xs text-muted-foreground">
          Think of it as a subject line — just for the URL.
        </p>
      </div>

      {/* Read-only From @handle */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">From</p>
        <p className="font-mono text-sm text-ink">@{senderHandle}</p>
      </div>

      {/* Live URL preview */}
      <div className="space-y-1 rounded-lg border border-border bg-muted/60 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Their link will be
        </p>
        <p
          id="url-preview"
          className="break-all font-mono text-sm text-ink"
          aria-live="polite"
          aria-label="Live URL preview"
        >
          {urlPreview}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isPending}
          className="flex-1 rounded-full bg-wax px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-wax-deep active:bg-wax-deep disabled:opacity-50"
        >
          Add the secret &rarr;
        </button>
      </div>
    </div>
  );
}
