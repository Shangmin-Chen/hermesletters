"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadPhoto, downloadAllPhotos } from "@/lib/download";

interface PhotoGalleryProps {
  /** Short-lived signed image URLs (already minted server-side). */
  urls: string[];
  /** Optional captions aligned to `urls` by index. May be shorter than `urls`. */
  captions?: (string | null)[];
  className?: string;
}

/**
 * PhotoGallery — the "photos" you take out of the envelope, on their own.
 *
 * Renders a thumbnail grid; tapping a thumbnail opens a full-screen lightbox
 * with prev/next, a counter, and a per-photo download. A toolbar above the grid
 * downloads every photo at once. All downloads go through `@/lib/download`,
 * which appends Supabase's `download` param so signed URLs save as files.
 */
export function PhotoGallery({ urls, captions, className }: PhotoGalleryProps) {
  // null → lightbox closed; otherwise the index of the open photo.
  const [active, setActive] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const count = urls.length;

  const close = useCallback(() => setActive(null), []);
  const next = useCallback(
    () => setActive((i) => (i === null ? i : (i + 1) % count)),
    [count]
  );
  const prev = useCallback(
    () => setActive((i) => (i === null ? i : (i - 1 + count) % count)),
    [count]
  );

  // Keyboard nav while the lightbox is open. Also locks body scroll.
  useEffect(() => {
    if (active === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, close, next, prev]);

  const handleDownloadAll = useCallback(async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    try {
      await downloadAllPhotos(urls);
    } finally {
      setDownloadingAll(false);
    }
  }, [urls, downloadingAll]);

  if (count === 0) return null;

  return (
    <div className={className}>
      {/* Toolbar — count + download-all */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs uppercase tracking-[0.18em] font-medium text-muted-foreground">
          {count} {count === 1 ? "photo" : "photos"}
        </p>
        {count > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="rounded-full"
          >
            {downloadingAll ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            {downloadingAll ? "Saving…" : "Download all"}
          </Button>
        )}
      </div>

      {/* Thumbnail grid */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {urls.map((url, i) => {
          const caption = captions?.[i] ?? null;
          return (
            <li key={i} className="group/photo relative flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setActive(i)}
                className="block w-full overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View photo ${i + 1} of ${count}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={caption ?? `Photo ${i + 1}`}
                  className="aspect-square w-full object-cover transition-transform duration-300 group-hover/photo:scale-[1.03]"
                />
              </button>
              {/* Per-thumbnail quick download */}
              <button
                type="button"
                onClick={() => downloadPhoto(url, i)}
                className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm opacity-0 transition-opacity group-hover/photo:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Download photo ${i + 1}`}
              >
                <Download className="size-3.5" aria-hidden />
              </button>
              {caption && (
                <p className="text-xs text-muted-foreground leading-snug px-0.5">
                  {caption}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* Lightbox */}
      {active !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${active + 1} of ${count}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-rise-in"
          onClick={close}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm tabular-nums text-white/80">
              {active + 1} / {count}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => downloadPhoto(urls[active], active)}
                className="inline-flex size-9 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Download this photo"
              >
                <Download className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex size-9 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Stage — clicking the dimmed area around the photo closes; the
              photo itself and the nav arrows stop the click from bubbling. */}
          <div className="relative flex flex-1 items-center justify-center px-4 pb-6 min-h-0">
            {count > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-2 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
            )}

            <div
              className="flex flex-col items-center gap-2 max-h-full min-h-0 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[active]}
                alt={captions?.[active] ?? `Photo ${active + 1}`}
                className="min-h-0 max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
              {captions?.[active] && (
                <p className="text-sm text-white/80 text-center max-w-md px-2">
                  {captions[active]}
                </p>
              )}
            </div>

            {count > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-2 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-4"
                aria-label="Next photo"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
