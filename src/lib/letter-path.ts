/**
 * Parse a public invite letter path of the form
 * `/{handle}/{receiver}/{letterName}` into its three URL components.
 */
export function parseLetterPath(
  path: string
): { handle: string; receiver: string; letterName: string } | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  const [handle, receiver, letterName] = parts;
  if (!handle || !receiver || !letterName) return null;
  return { handle, receiver, letterName };
}
