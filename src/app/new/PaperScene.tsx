"use client";

import { type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * PaperScene — scene 1 of the compose ritual: the blank sheet (T3.1).
 *
 * Presentational only. It owns no state and no inputs of its own — the body
 * textarea and the photo file input are passed in / wired by the orchestrator
 * (ComposeLetter), which keeps them mounted across every step so FormData,
 * the FileList, and draft autosave survive scene changes.
 *
 * The body field is styled as paper: serif, ~1.85 leading, no rule lines (the
 * `body::after` paper tooth provides texture), auto-grow, and a visible inset
 * focus ring with ≥3:1 non-text contrast against --paper in both modes (T3.1b).
 * The "Fold the letter →" CTA is sticky so it stays above the mobile keyboard
 * (T3.1).
 */

export type SelectedImage = {
  file: File;
  url: string;
  warning: string | null;
};

interface PaperSceneProps {
  // Body textarea wiring (input itself is rendered here but fully controlled by
  // the orchestrator; it never unmounts because the scene only toggles hidden).
  body: string;
  onBodyChange: (value: string) => void;
  bodyRef: React.Ref<HTMLTextAreaElement>;
  // Photo input wiring.
  fileInputRef: React.Ref<HTMLInputElement>;
  acceptedExtensions: string;
  onFilesChange: (e: ChangeEvent<HTMLInputElement>) => void;
  images: SelectedImage[];
  onClearImages: () => void;
  hasWarnings: boolean;
  // Fold gesture.
  onFold: () => void;
  isPending: boolean;
}

export function PaperScene({
  body,
  onBodyChange,
  bodyRef,
  fileInputRef,
  acceptedExtensions,
  onFilesChange,
  images,
  onClearImages,
  hasWarnings,
  onFold,
  isPending,
}: PaperSceneProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="body" className="text-sm font-medium text-foreground">
          Write freely
        </Label>

        {/* The paper sheet. Borderless so it reads as a sheet, with a visible
            inset focus ring (focus-visible) that meets non-text contrast ≥3:1
            against --paper in light and dark; the wax caret is a secondary cue,
            not the only one. `field-sizing: content` auto-grows; the orchestrator
            also runs a JS height-sync on input + after draft restore. */}
        <textarea
          id="body"
          name="body"
          ref={bodyRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          disabled={isPending}
          rows={9}
          placeholder="Dear Jane,&#10;&#10;I wanted you to know…"
          aria-describedby="body-hint"
          className="block w-full resize-none rounded-lg bg-paper px-4 py-3 font-serif text-base leading-[1.85] text-ink outline-none transition-shadow [field-sizing:content] placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-wax disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p id="body-hint" className="text-xs text-muted-foreground">
          Saved as a draft on this device as you write — never the secret answer.
        </p>
      </div>

      {/* Photos (optional). The file input is owned by the orchestrator; the
          previews / warnings below mirror the old form verbatim. */}
      <div className="space-y-1.5">
        <Label htmlFor="images" className="text-sm font-medium text-foreground">
          Tuck in a photo{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="images"
          name="images"
          type="file"
          multiple
          ref={fileInputRef}
          accept={acceptedExtensions}
          onChange={onFilesChange}
          disabled={isPending}
          className="focus-visible:ring-ring file:text-sm file:font-medium file:text-foreground"
          aria-describedby="images-hint"
        />
        <p id="images-hint" className="text-xs text-muted-foreground">
          PNG, JPEG, GIF, or WEBP. They appear below the letter once it&apos;s
          unlocked.
        </p>

        {images.length > 0 && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              {/* Single polite live region for the count (no double-speak). */}
              <p className="text-xs font-medium text-foreground" aria-live="polite">
                {images.length} photo{images.length === 1 ? "" : "s"} selected
              </p>
              <button
                type="button"
                onClick={onClearImages}
                disabled={isPending}
                className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                Clear all
              </button>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img, i) => (
                <li key={`${img.file.name}-${i}`} className="space-y-1">
                  <div
                    className={`relative aspect-square overflow-hidden rounded-lg border ${
                      img.warning ? "border-destructive/50" : "border-border"
                    } bg-muted/40`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Preview of ${img.file.name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p
                    className="truncate text-[11px] text-muted-foreground"
                    title={img.file.name}
                  >
                    {img.file.name}
                  </p>
                  {img.warning && (
                    <p className="text-[11px] leading-snug text-destructive">
                      {img.warning}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {hasWarnings && (
              <p className="text-xs text-destructive" role="alert">
                Some photos may be rejected when you send — fix or remove them
                first.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sticky CTA — stays above the mobile keyboard (within the visual
          viewport). type=button so it never triggers the form's submit/clear. */}
      <div className="sticky bottom-3 z-10 -mx-1 pt-2">
        <button
          type="button"
          onClick={onFold}
          disabled={isPending}
          className="w-full rounded-full bg-wax px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-wax-deep active:bg-wax-deep disabled:opacity-50"
        >
          Fold the letter &rarr;
        </button>
      </div>
    </div>
  );
}
