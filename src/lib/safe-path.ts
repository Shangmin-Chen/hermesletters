/**
 * Returns true ONLY when `next` is a safe local relative path:
 *  - must be a non-empty string
 *  - must start with "/"
 *  - must NOT start with "//" (protocol-relative URL)
 *  - must NOT start with "/\" (backslash bypass: /\evil.com resolves externally in some clients)
 *  - must NOT contain any backslash (prevents encoding tricks like /foo\@evil.com)
 *  - must NOT contain "://" (absolute URL)
 *  - must NOT contain ASCII control characters (U+0000–U+001F)
 */
export function isSafeLocalPath(next: string): boolean {
  return (
    typeof next === "string" &&
    next.length > 0 &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    !next.includes("\\") &&
    !next.includes("://") &&
    !/[\x00-\x1F]/.test(next)
  );
}
