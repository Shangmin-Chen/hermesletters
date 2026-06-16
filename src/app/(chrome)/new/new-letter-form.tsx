"use client";

import { useActionState, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createLetterAction, type CreateLetterState } from "./actions";
import { slugify } from "@/lib/slugify";
import { Eye, EyeOff, ImagePlus, X } from "lucide-react";

interface NewLetterFormProps {
  senderHandle: string;
}

interface ImagePreview {
  file: File;
  objectUrl: string;
}

export function NewLetterForm({ senderHandle }: NewLetterFormProps) {
  const [state, formAction, isPending] = useActionState<
    CreateLetterState,
    FormData
  >(createLetterAction, null);
  const [receiverName, setReceiverName] = useState("");
  const [letterName, setLetterName] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const receiverSlug = slugify(receiverName);
  const letterSlug = slugify(letterName);

  // Write a list of previews back to the underlying file input so the form
  // submits exactly what's shown.
  const syncInput = useCallback((previews: ImagePreview[]) => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    previews.forEach((p) => dt.items.add(p.file));
    fileInputRef.current.files = dt.files;
  }, []);

  // Append image files (from browse or drag-and-drop) to the current list,
  // skipping non-images and duplicates.
  const addFiles = useCallback(
    (incoming: File[]) => {
      const images = incoming.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;

      setImagePreviews((prev) => {
        const existing = new Set(prev.map((p) => `${p.file.name}:${p.file.size}`));
        const additions = images
          .filter((f) => !existing.has(`${f.name}:${f.size}`))
          .map((file) => ({ file, objectUrl: URL.createObjectURL(file) }));
        const next = [...prev, ...additions];
        syncInput(next);
        return next;
      });
    },
    [syncInput]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeImage = useCallback((index: number) => {
    setImagePreviews((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].objectUrl);
      next.splice(index, 1);
      syncInput(next);
      return next;
    });
  }, [syncInput]);

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* ── Block 1: Address & URL ─────────────────────────────────────── */}
      <section
        aria-label="Address"
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="font-serif text-base font-semibold text-ink">
          Address it
        </h2>

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
      </section>

      {/* ── Block 2: The letter body — paper-styled writing surface ───────── */}
      <section
        aria-label="Letter body"
        className="rounded-xl border border-border overflow-hidden shadow-sm"
      >
        <div className="bg-muted/50 border-b border-border px-5 py-3">
          <h2 className="font-serif text-base font-semibold text-ink">
            Your letter
          </h2>
        </div>
        <div className="bg-paper">
          <Label htmlFor="body" className="sr-only">
            Letter body
          </Label>
          <textarea
            id="body"
            name="body"
            placeholder="Dear Jane,&#10;&#10;Write your letter here..."
            required
            disabled={isPending}
            rows={16}
            className="
              w-full resize-none bg-transparent px-6 py-5
              font-serif text-base leading-[1.85] text-ink tracking-[0.01em]
              placeholder:text-muted-foreground/50
              focus:outline-none
              disabled:opacity-60
            "
            style={{ minHeight: "20rem" }}
          />
        </div>
      </section>

      {/* ── Block 3: Lock & logistics ─────────────────────────────────────── */}
      <section
        aria-label="Lock"
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="font-serif text-base font-semibold text-ink">
          Lock &amp; seal it
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="question">A question only they can answer</Label>
          <Input
            id="question"
            name="question"
            placeholder="e.g. What was the name of our dog?"
            required
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            They&apos;ll need to answer this to unlock the letter.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="answer">The answer</Label>
          <div className="relative">
            <Input
              id="answer"
              name="answer"
              type={showAnswer ? "text" : "password"}
              placeholder="e.g. Biscuit"
              required
              disabled={isPending}
              autoComplete="off"
              className="pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
              aria-label={showAnswer ? "Hide answer" : "Show answer"}
              onClick={() => setShowAnswer((v) => !v)}
              tabIndex={0}
            >
              {showAnswer ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Case-insensitive. They&apos;ll only see its length and spaces — not
            the answer itself.
          </p>
        </div>

        {/* ── Images ── */}
        <div className="space-y-2 pt-1">
          <Label htmlFor="images">Images (optional)</Label>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, GIF, or WEBP · max 5 MB each. Images appear below the
            letter once unlocked.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isPending) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={isPending ? undefined : handleDrop}
            onClick={() => !isPending && fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
              isDragging
                ? "border-ring bg-muted/60"
                : "border-border hover:bg-muted/40"
            } ${isPending ? "pointer-events-none opacity-60" : ""}`}
          >
            <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-foreground">
              <span className="font-medium">Drag &amp; drop</span> images here, or{" "}
              <span className="underline">browse</span>
            </p>
          </div>

          <Input
            ref={fileInputRef}
            id="images"
            name="images"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={isPending}
            onChange={handleFileChange}
            className="sr-only"
          />

          {/* Thumbnail previews */}
          {imagePreviews.length > 0 && (
            <ul
              className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4"
              aria-label="Selected images"
            >
              {imagePreviews.map((preview, i) => (
                <li key={preview.objectUrl} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.objectUrl}
                    alt={preview.file.name}
                    className="h-20 w-full rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-destructive shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
                    aria-label={`Remove ${preview.file.name}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground leading-none">
                    {preview.file.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isPending}
      >
        {isPending ? "Sealing your letter…" : "Send letter"}
      </Button>
    </form>
  );
}
