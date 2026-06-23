import "server-only";

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { requireProfile } from "@/lib/auth";
import { mintLetterImageSignedUrls } from "@/lib/supabase/signed-urls";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Envelope } from "@/components/brand/Envelope";
import { buttonVariants } from "@/components/ui/button";
import { PhotoGallery } from "@/components/letter/PhotoGallery";
import { cn } from "@/lib/utils";
import { zipFilter } from "@/lib/zip-filter";
import { ArchiveKeptLetterButton } from "../../ArchiveKeptLetterButton";
import { RestoreKeptLetterButton } from "../../RestoreKeptLetterButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceivedLetterPage({ params }: PageProps) {
  const { id } = await params;

  // ── Auth: require a logged-in user with a profile ──────────────────────────
  const profile = await requireProfile();

  // ── Step 1: load only the fields needed to authorize (defense-in-depth) ───
  //
  // We intentionally do NOT select body / claim_token here.
  // Sensitive content is only fetched AFTER the ownership check passes below.
  const [authRow] = await db
    .select({
      id: letters.id,
      savedBy: letters.savedBy,
      savedAt: letters.savedAt,
      archivedAt: letters.archivedAt,
      senderHandle: letters.senderHandle,
      letterName: letters.letterName,
      receiverName: letters.receiverName,
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
  // claim_token is never selected here.
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
  // Zip captions to rows BEFORE filtering so a failed URL mint drops its caption.
  const signedUrls = await mintLetterImageSignedUrls(
    imageRows.map((img) => img.storagePath)
  );
  const rowCaptions = imageRows.map((img) => img.caption ?? null);
  const { a: validUrls, b: validCaptions } = zipFilter(
    signedUrls,
    rowCaptions,
    (url): url is string => url !== null
  );

  const savedDate = new Date(authRow.savedAt).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isArchived = authRow.archivedAt !== null;

  return (
    <main className="min-h-screen p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-xl">

        {/* ── Back link ─────────────────────────────────────────────────── */}
        <div className="mb-6 animate-rise-in">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm min-h-[44px]"
          >
            <span aria-hidden>←</span>
            <span>Dashboard</span>
          </Link>
        </div>

        {/* ── Letter card ───────────────────────────────────────────────── */}
        <article
          className="rounded-2xl border border-border bg-card shadow-md overflow-hidden animate-rise-in"
          style={{ animationDelay: "60ms" }}
          aria-label={`Letter: ${authRow.letterName ?? "Received letter"}`}
        >

          {/* Header band */}
          <header className="bg-muted border-b border-border px-6 py-5 text-center">
            <div className="flex justify-center mb-3">
              <Envelope
                state="open"
                className="w-14 h-14 text-wax animate-rise-in"
                aria-hidden
              />
            </div>

            {/* Letter name / title */}
            {authRow.letterName && (
              <h1 className="line-clamp-2 font-serif text-xl font-semibold text-foreground leading-snug mb-2">
                {authRow.letterName}
              </h1>
            )}

            {isArchived && (
              <span className="mb-2 inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}

            {/* Attribution caption */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              From{" "}
              <span className="font-mono font-medium text-foreground">
                @{authRow.senderHandle}
              </span>
              {authRow.receiverName && (
                <>
                  {" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span>to {authRow.receiverName}</span>
                </>
              )}
              <br />
              <span className="text-xs text-muted-foreground">
                Kept {savedDate}
              </span>
            </p>
          </header>

          {/* ── Letter body ─────────────────────────────────────────────── */}
          <div
            className="px-6 py-8 sm:px-10 animate-unfold"
            style={{ animationDelay: "160ms" }}
          >
            {/*
             * body is plain text; React escapes it automatically.
             * whitespace-pre-wrap preserves line breaks without
             * dangerouslySetInnerHTML.
             */}
            <div className="font-serif text-base text-foreground leading-[1.85] whitespace-pre-wrap tracking-[0.01em]">
              {contentRow.body}
            </div>
          </div>

          {/* ── Photos — their own section, downloadable ──────────────────── */}
          {validUrls.length > 0 && (
            <div
              className="border-t border-border px-6 py-6 sm:px-10 animate-rise-in"
              style={{ animationDelay: "260ms" }}
            >
              <PhotoGallery urls={validUrls} captions={validCaptions} />
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <footer className="border-t border-border bg-muted/50 px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isArchived
                ? "This letter is archived. Restore it to bring it back to your kept list."
                : "This letter is kept for as long as you want it — yours to revisit or archive."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-10 rounded-full bg-background/80"
                )}
              >
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Back to dashboard
              </Link>
              {isArchived ? (
                <RestoreKeptLetterButton letterId={authRow.id} />
              ) : (
                <ArchiveKeptLetterButton letterId={authRow.id} redirectOnDone />
              )}
            </div>
          </footer>

        </article>
      </div>
    </main>
  );
}
