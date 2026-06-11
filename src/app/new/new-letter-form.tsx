"use client";

import { useActionState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createLetterAction, type CreateLetterState } from "./actions";
import { slugify } from "@/lib/slugify";

interface NewLetterFormProps {
  senderHandle: string;
}

export function NewLetterForm({ senderHandle }: NewLetterFormProps) {
  const [state, formAction, isPending] = useActionState<CreateLetterState, FormData>(
    createLetterAction,
    null
  );

  // Track receiver and letter name for live URL preview
  const receiverRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);

  // We compute the preview URL live in a controlled way via useState-like approach.
  // Since we need live updates, use a simple onInput approach.

  function getPreviewSlug(value: string): string {
    return slugify(value);
  }

  function updatePreview() {
    const receiverSlug = getPreviewSlug(receiverRef.current?.value ?? "");
    const letterSlug = getPreviewSlug(letterRef.current?.value ?? "");
    const previewEl = document.getElementById("url-preview");
    if (previewEl) {
      const receiverPart = receiverSlug || "<receiver>";
      const letterPart = letterSlug || "<letter>";
      previewEl.textContent = `/${senderHandle}/${receiverPart}/${letterPart}`;
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="receiver_name">Receiver name</Label>
        <Input
          id="receiver_name"
          name="receiver_name"
          ref={receiverRef}
          placeholder="e.g. Jane"
          onInput={updatePreview}
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Who is this letter for? Will be slugified in the URL.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="letter_name">Letter name</Label>
        <Input
          id="letter_name"
          name="letter_name"
          ref={letterRef}
          placeholder="e.g. Summer 2025"
          onInput={updatePreview}
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          A short name for this letter. Will be slugified in the URL.
        </p>
      </div>

      {/* Live URL preview */}
      <div className="rounded-md bg-muted px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Your letter URL will be:</p>
        <p
          id="url-preview"
          className="font-mono text-sm break-all"
        >
          /{senderHandle}/{"<receiver>"}{"/<letter>"}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Letter body</Label>
        <Textarea
          id="body"
          name="body"
          placeholder="Write your letter here…"
          rows={8}
          required
          disabled={isPending}
          className="resize-y"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="question">Security question</Label>
        <Input
          id="question"
          name="question"
          placeholder="e.g. What was the name of our dog?"
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          The receiver must answer this to unlock the letter.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="answer">Answer</Label>
        <Input
          id="answer"
          name="answer"
          type="password"
          placeholder="e.g. Biscuit"
          required
          disabled={isPending}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Case-insensitive. The receiver sees only the length and spaces — not the answer itself.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="images">Images (optional)</Label>
        <Input
          id="images"
          name="images"
          type="file"
          multiple
          accept="image/*"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Attach one or more images. They appear below the letter body after the receiver unlocks it.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Send letter"}
      </Button>
    </form>
  );
}
