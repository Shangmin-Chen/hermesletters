"use client";

import { useState, type ReactNode } from "react";
import { FileText, Images } from "lucide-react";
import { LetterSheet } from "@/components/letter/LetterSheet";
import { PhotoGallery } from "@/components/letter/PhotoGallery";

interface EnvelopeContentsProps {
  /** The letter body (plain text). Rendered onto the paper sheet once taken out. */
  body: string;
  /** Signed photo URLs. When empty, only the letter is offered. */
  imageUrls: string[];
  /**
   * The expiry + keep-flow footer, server-rendered and passed through. It always
   * stays below the contents so the keep action is reachable from the start.
   */
  footer: ReactNode;
}

/**
 * EnvelopeContents — the "lootbox" of an opened letter.
 *
 * Inside the envelope are two separate things you reach in and take out: the
 * LETTER (a paper sheet) and the PHOTOS (a gallery). Each sits as a closed item
 * in a tray; tapping it lifts it out — the letter unfolds onto paper, the photos
 * open as a gallery with per-photo and download-all options. Items already taken
 * out drop out of the tray; the keep-flow footer stays put underneath.
 */
export function EnvelopeContents({
  body,
  imageUrls,
  footer,
}: EnvelopeContentsProps) {
  const hasPhotos = imageUrls.length > 0;
  const [letterOut, setLetterOut] = useState(false);
  const [photosOut, setPhotosOut] = useState(false);

  // Tray is gone once everything's been lifted out.
  const trayVisible = !letterOut || (hasPhotos && !photosOut);

  return (
    <div className="flex flex-col gap-6">
      {/* ── The tray of things still inside the envelope ──────────────────── */}
      {trayVisible && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-[0.18em] font-medium text-wax">
            Reach in
          </p>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {!letterOut && (
              <TrayItem
                icon={<FileText className="size-5" aria-hidden />}
                title="The letter"
                hint="Tap to unfold"
                onClick={() => setLetterOut(true)}
              />
            )}
            {hasPhotos && !photosOut && (
              <TrayItem
                icon={<Images className="size-5" aria-hidden />}
                title={`${imageUrls.length} ${
                  imageUrls.length === 1 ? "photo" : "photos"
                }`}
                hint="Tap to open"
                onClick={() => setPhotosOut(true)}
                preview={imageUrls[0]}
              />
            )}
          </div>
        </div>
      )}

      {/* ── The letter, taken out and unfolded ────────────────────────────── */}
      {letterOut && (
        <div className="animate-lift-out">
          <LetterSheet
            className="mx-auto w-full"
            sheetClassName="min-h-[18rem]"
            contentClassName="px-7 py-9 sm:px-10 sm:py-11"
            textureName="natural-paper"
            aging
            folds
          >
            {/*
             * body is plain text; React escapes it by default. whitespace-pre-wrap
             * preserves the writer's line breaks without splitting on newlines.
             */}
            <div className="font-serif text-foreground text-base leading-[1.85] tracking-[0.01em] whitespace-pre-wrap">
              {body}
            </div>
          </LetterSheet>
        </div>
      )}

      {/* ── The photos, taken out as their own gallery ────────────────────── */}
      {photosOut && (
        <div className="animate-lift-out rounded-2xl border border-border/60 bg-card/70 px-5 py-5 shadow-sm">
          <PhotoGallery urls={imageUrls} />
        </div>
      )}

      {/* ── Keep / expiry footer (always reachable) ───────────────────────── */}
      {footer}
    </div>
  );
}

/** A single closed item resting in the tray, waiting to be lifted out. */
function TrayItem({
  icon,
  title,
  hint,
  onClick,
  preview,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  preview?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/item relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-wax/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-wax">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt=""
            aria-hidden
            className="size-full object-cover"
          />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-base font-medium text-foreground">
          {title}
        </span>
        <span className="block text-xs text-muted-foreground transition-colors group-hover/item:text-wax">
          {hint}
        </span>
      </span>
    </button>
  );
}
