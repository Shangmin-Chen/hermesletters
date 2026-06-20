import "server-only";

import { adminClient } from "@/lib/supabase/admin";

const LETTER_IMAGE_URL_TTL_SECONDS = 60 * 60;

export async function mintLetterImageSignedUrls(
  storagePaths: string[],
  expiresIn = LETTER_IMAGE_URL_TTL_SECONDS
): Promise<(string | null)[]> {
  if (storagePaths.length === 0) return [];

  const { data, error } = await adminClient.storage
    .from("letters")
    .createSignedUrls(storagePaths, expiresIn);

  if (error || !data) {
    return storagePaths.map(() => null);
  }

  const signedByPath = new Map(
    data.map((entry) => [entry.path, entry.signedUrl ?? null])
  );

  return storagePaths.map((path) => signedByPath.get(path) ?? null);
}
