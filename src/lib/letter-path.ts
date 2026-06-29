/**
 * Parse a public invite letter path.
 * Supports legacy `/{handle}/{receiver}/{letterName}` and v2 `/l/{publicId}`.
 */
export type ParsedLetterPath =
  | { kind: "v2"; publicId: string }
  | { kind: "legacy"; handle: string; receiver: string; letterName: string };

export function parseLetterPath(path: string): ParsedLetterPath | null {
  const pathname = path.split(/[?#]/, 1)[0];
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "l") {
    const publicId = parts[1];
    if (!publicId) return null;
    return { kind: "v2", publicId };
  }
  if (parts.length === 3) {
    const [handle, receiver, letterName] = parts;
    if (!handle || !receiver || !letterName) return null;
    return { kind: "legacy", handle, receiver, letterName };
  }
  return null;
}
