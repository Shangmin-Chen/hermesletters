"use client";

import { useState, type ReactNode } from "react";
import { FileText, Images, ArrowLeft } from "lucide-react";
import { PhotoGallery } from "@/components/letter/PhotoGallery";

interface EnvelopeContentsProps {
  /** The letter body (plain text). Rendered onto the paper sheet once taken out. */
  body: string;
  /** Signed photo URLs. When empty, only the letter is offered. */
  imageUrls: string[];
  /**
   * The expiry + keep-flow footer, server-rendered and passed through. It always
   * stays below the contents so the keep action is reachable from every view.
   */
  footer: ReactNode;
}

/** Which thing is currently out of the envelope. Only ever one at a time. */
type View = "tray" | "letter" | "photos";

/**
 * EnvelopeContents — the "lootbox" of an opened letter.
 *
 * Inside the envelope are two separate things you reach in and take out: the
 * LETTER (a paper sheet) and the PHOTOS (a gallery). You can only have ONE out
 * at a time — opening either replaces the tray, and a "Put it back in the
 * envelope" control returns you to the tray to choose the other. The keep-flow
 * footer stays visible in every view.
 */
export function EnvelopeContents({
  body,
  imageUrls,
  footer,
}: EnvelopeContentsProps) {
  const hasPhotos = imageUrls.length > 0;
  const [view, setView] = useState<View>("tray");

  return (
    <div className="flex flex-col gap-6">
      {/* ── The tray: the things still inside the envelope ────────────────── */}
      {view === "tray" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-[0.18em] font-medium text-wax">
            Reach in
          </p>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <TrayItem
              icon={<FileText className="size-5" aria-hidden />}
              title="The letter"
              hint="Tap to unfold"
              onClick={() => setView("letter")}
            />
            {hasPhotos && (
              <TrayItem
                icon={<Images className="size-5" aria-hidden />}
                title={`${imageUrls.length} ${
                  imageUrls.length === 1 ? "photo" : "photos"
                }`}
                hint="Tap to open"
                onClick={() => setView("photos")}
                preview={imageUrls[0]}
              />
            )}
          </div>
        </div>
      )}

      {/* ── The letter, taken out — plain paper, like the writing field ───── */}
      {view === "letter" && (
        <div className="flex flex-col gap-3 animate-lift-out">
          <PutBack onClick={() => setView("tray")} />
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            {/*
             * Mirrors the compose "Write" field: a clean bg-paper sheet with the
             * sender's serif type — no texture, aging, or trifold creases. body is
             * plain text; React escapes it, whitespace-pre-wrap keeps line breaks.
             */}
            <div className="bg-paper px-6 py-5 font-serif text-base leading-[1.85] text-ink tracking-[0.01em] whitespace-pre-wrap">
              {body}
            </div>
          </div>
        </div>
      )}

      {/* ── The photos, taken out as their own gallery ────────────────────── */}
      {view === "photos" && (
        <div className="flex flex-col gap-3 animate-lift-out">
          <PutBack onClick={() => setView("tray")} />
          <div className="rounded-2xl border border-border/60 bg-card/70 px-5 py-5 shadow-sm">
            <PhotoGallery urls={imageUrls} />
          </div>
        </div>
      )}

      {/* ── Keep / expiry footer (always reachable) ───────────────────────── */}
      {footer}
    </div>
  );
}

/** "Put it back in the envelope" — returns to the tray to pick the other item. */
function PutBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-2 hover:text-wax hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm min-h-[44px]"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Put it back in the envelope
    </button>
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
