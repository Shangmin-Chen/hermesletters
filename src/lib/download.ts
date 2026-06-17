// ---------------------------------------------------------------------------
// Client-side download helpers for letter photos.
//
// Photos live in a private Supabase Storage bucket; the server hands the client
// short-lived SIGNED URLs (never raw storage paths). To force a *download*
// (instead of opening the image inline) we append Supabase's `download` query
// param, which makes Storage respond with `Content-Disposition: attachment`.
// That works cross-origin where the HTML `download` attribute alone does not.
// ---------------------------------------------------------------------------

/** Pull a file extension (no dot) out of a signed URL's path, defaulting to jpg. */
function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const dot = path.lastIndexOf(".");
    if (dot !== -1) {
      const ext = path.slice(dot + 1).toLowerCase();
      // Guard against junk; storage paths are simple image extensions.
      if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
    }
  } catch {
    // fall through to default
  }
  return "jpg";
}

/** A friendly download filename like `hermes-photo-1.jpg`. */
export function photoFilename(url: string, index: number): string {
  return `hermes-photo-${index + 1}.${extFromUrl(url)}`;
}

/** Trigger a browser download for a single signed photo URL. */
export function downloadPhoto(url: string, index: number): void {
  const filename = photoFilename(url, index);
  let href = url;
  try {
    const u = new URL(url);
    // Supabase honours `download=<name>` → Content-Disposition: attachment.
    u.searchParams.set("download", filename);
    href = u.toString();
  } catch {
    // Non-URL string (shouldn't happen) — fall back to the raw value.
  }

  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download every photo. Browsers throttle/deny rapid programmatic downloads,
 * so we stagger them. Returns once all have been kicked off.
 */
export async function downloadAllPhotos(urls: string[]): Promise<void> {
  for (let i = 0; i < urls.length; i++) {
    downloadPhoto(urls[i], i);
    // Small gap so the browser doesn't collapse these into a single prompt.
    if (i < urls.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}
