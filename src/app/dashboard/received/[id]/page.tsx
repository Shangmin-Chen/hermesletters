import "server-only";

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { requireProfile } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Mint a signed URL for a storage path in the private "letters" bucket.
 * Expires in 1 hour (short-lived URLs are safer even for owned content).
 */
async function mintSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await adminClient.storage
    .from("letters")
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export default async function ReceivedLetterPage({ params }: PageProps) {
  const { id } = await params;

  // ── Auth: require a logged-in user with a profile ──────────────────────────
  const profile = await requireProfile();

  // ── Step 1: load only the fields needed to authorize (defense-in-depth) ───
  //
  // We intentionally do NOT select body / answer_normalized / claim_token here.
  // Sensitive content is only fetched AFTER the ownership check passes below.
  const [authRow] = await db
    .select({
      id: letters.id,
      savedBy: letters.savedBy,
      savedAt: letters.savedAt,
      senderHandle: letters.senderHandle,
    })
    .from(letters)
    .where(eq(letters.id, id))
    .limit(1);

  if (!authRow) notFound();

  // ── Explicit ownership check (orphan-safe) ─────────────────────────────────
  //
  // Per drizzle/README.md: deleting a receiver's profile leaves the row with
  // status='saved' AND saved_by=NULL. We must check BOTH:
  //   1. saved_by is non-null (not an orphan)
  //   2. saved_by equals the current user's id
  //
  // Also check saved_at is non-null as an extra orphan guard.
  // If either check fails → 404 (do NOT reveal the letter exists or its content).
  if (
    authRow.savedBy === null ||
    authRow.savedAt === null ||
    authRow.savedBy !== profile.id
  ) {
    notFound();
  }

  // ── Step 2: ownership verified — now load body and images for rendering ────
  //
  // answer_normalized and claim_token are never selected here.
  const [contentRow] = await db
    .select({ body: letters.body })
    .from(letters)
    .where(eq(letters.id, id))
    .limit(1);

  // Should not happen (row existed one moment ago), but guard defensively.
  if (!contentRow) notFound();

  // ── Load images ordered by position ───────────────────────────────────────
  const imageRows = await db
    .select()
    .from(letterImages)
    .where(eq(letterImages.letterId, authRow.id))
    .orderBy(letterImages.position);

  // ── Mint signed URLs server-side (never expose storage paths to client) ───
  const signedUrls = await Promise.all(
    imageRows.map((img) => mintSignedUrl(img.storagePath))
  );
  const validUrls = signedUrls.filter((u): u is string => u !== null);

  const savedDate = new Date(authRow.savedAt).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-neutral-50 p-4">
      <div className="mx-auto max-w-xl">
        {/* Back to dashboard */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
          >
            &larr; Dashboard
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Letter">
              📨
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Received Letter
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              From{" "}
              <span className="font-mono font-medium">@{authRow.senderHandle}</span>{" "}
              &middot; saved {savedDate}
            </p>
          </div>

          {/* Letter body */}
          <div className="px-6 py-8">
            {/*
             * body is plain text; React escapes it automatically.
             * We use whitespace-pre-wrap to preserve line breaks without
             * dangerouslySetInnerHTML.
             */}
            <div className="text-neutral-800 text-base leading-relaxed whitespace-pre-wrap">
              {contentRow.body}
            </div>

            {/* Image gallery */}
            {validUrls.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {validUrls.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={url}
                    alt={`Image ${i + 1}`}
                    className="w-full rounded-lg border border-neutral-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-4 text-center">
            <p className="text-xs text-neutral-400">
              This letter is saved to your account and will remain here
              permanently.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
