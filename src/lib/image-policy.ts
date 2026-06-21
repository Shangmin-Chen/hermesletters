export const MAX_LETTER_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;

export function formatMegabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
