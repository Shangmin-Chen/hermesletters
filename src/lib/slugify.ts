/**
 * Slugify a handle: lowercase, spaces→dashes, strip illegal chars.
 * Returns the slugified string; returns empty string if invalid.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validate that a slugified handle is acceptable. */
export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(handle) || /^[a-z0-9]$/.test(handle);
}
