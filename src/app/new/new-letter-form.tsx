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
  const [state, formAction, isPending] = useActionState<
    CreateLetterState,
    FormData
  >(createLetterAction, null);
  const [receiverName, setReceiverName] = useState("");
  const [letterName, setLetterName] = useState("");

  const receiverSlug = slugify(receiverName);
  const letterSlug = slugify(letterName);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="receiver_name">Receiver name</Label>
        <Input
          id="receiver_name"
          name="receiver_name"
          placeholder="e.g. Jane"
          value={receiverName}
          onChange={(event) => setReceiverName(event.target.value)}
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Who is this letter for? This becomes part of the URL.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="letter_name">Letter name</Label>
        <Input
          id="letter_name"
          name="letter_name"
          placeholder="e.g. Summer 2025"
          value={letterName}
          onChange={(event) => setLetterName(event.target.value)}
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          A short name for this letter. This also becomes part of the URL.
        </p>
      </div>

      <div className="rounded-md bg-muted px-4 py-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Your letter URL will be:
        </p>
        <p id="url-preview" className="break-all font-mono text-sm">
          /{senderHandle}/{receiverSlug || "<receiver>"}/
          {letterSlug || "<letter>"}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Letter body</Label>
        <Textarea
          id="body"
          name="body"
          placeholder="Write your letter here..."
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
          Case-insensitive. The receiver sees only the length and spaces.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="images">Images (optional)</Label>
        <Input
          id="images"
          name="images"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, GIF, or WEBP. Images appear below the letter once unlocked.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending..." : "Send letter"}
      </Button>
    </form>
  );
}
