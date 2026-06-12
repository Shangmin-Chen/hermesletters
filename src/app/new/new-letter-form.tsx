"use client";

import { useActionState, useState } from "react";
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

  const [receiverSlug, setReceiverSlug] = useState("");
  const [letterSlug, setLetterSlug] = useState("");

  const previewPath = `/${senderHandle}/${receiverSlug || "<receiver>"}/${
    letterSlug || "<letter>"
  }`;

  return (
    <form action={formAction} className="space-y-8">
      {/* Error banner */}
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive"
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
            onChange={(e) => setReceiverSlug(slugify(e.target.value))}
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
            onChange={(e) => setLetterSlug(slugify(e.target.value))}
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
            required
            disabled={isPending}
            className="resize-y focus-visible:ring-ring transition-shadow font-serif text-base leading-[1.85] px-4 py-3 placeholder:font-sans placeholder:text-sm"
          />
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
            accept="image/*"
            disabled={isPending}
            className="focus-visible:ring-ring file:text-sm file:font-medium file:text-foreground"
            aria-describedby="images-hint"
          />
          <p id="images-hint" className="text-xs text-muted-foreground">
            They appear below the letter once it&apos;s unlocked.
          </p>
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
          <Input
            id="answer"
            name="answer"
            type="password"
            placeholder="e.g. Biscuit"
            required
            disabled={isPending}
            autoComplete="off"
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="answer-hint"
          />
          <p id="answer-hint" className="text-xs text-muted-foreground">
            Not case-sensitive. They see the shape of the answer (length &amp; spaces) — not the letters.
          </p>
        </div>
      </section>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full bg-wax text-primary-foreground hover:bg-wax-deep transition-colors rounded-full py-2.5 text-sm font-medium shadow-sm"
        disabled={isPending}
      >
        {isPending ? "Sealing your letter…" : "Seal & send"}
      </Button>
    </form>
  );
}
