import "server-only";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LayoutDashboard } from "lucide-react";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { requireProfile } from "@/lib/auth";
import { mintLetterImageSignedUrls } from "@/lib/supabase/signed-urls";
import { Envelope } from "@/components/brand/Envelope";
import { buttonVariants } from "@/components/ui/button";
import { PhotoGallery } from "@/components/letter/PhotoGallery";
import { LocalDateTime } from "@/components/LocalDateTime";
import { Countdown } from "@/app/[handle]/[receiver]/[letter]/Countdown";
import { KeepButton } from "@/app/[handle]/[receiver]/[letter]/KeepButton";
import { zipFilter } from "@/lib/zip-filter";
import { cn } from "@/lib/utils";
import { InboxLockedView } from "./InboxLockedView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InboxLetterPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();

  // ── Auth fields only — never reveal existence/content unless it's ours ────
  const [authRow] = await db
    .select({
      id: letters.id,
      receiverId: letters.receiverId,
      status: letters.status,
      senderHandle: letters.senderHandle,
      letterName: letters.letterName,
      savedBy: letters.savedBy,
      expiresAt: letters.expiresAt,
      secretPrompt: letters.secretPrompt,
      secretAnswerShape: letters.secretAnswerShape,
    })
    .from(letters)
    .where(eq(letters.id, id))
    .limit(1);

  // Ownership gate: must be a direct letter addressed to the current user.
  if (!authRow || authRow.receiverId !== profile.id) notFound();

  if (authRow.status === "saved" && authRow.savedBy === profile.id) {
    redirect(`/dashboard/received/${authRow.id}`);
  }

  const now = new Date();
  const expiredByTime =
    authRow.status === "opened" &&
    authRow.expiresAt !== null &&
    authRow.savedBy === null &&
    now >= authRow.expiresAt;

  if (authRow.status === "expired" || expiredByTime) {
    return <ExpiredInboxLetter senderHandle={authRow.senderHandle} />;
  }

  // ── Sealed: show the wax-unseal ceremony ──────────────────────────────────
  if (authRow.status === "unopened") {
    return (
      <InboxLockedView
        letterId={authRow.id}
        senderHandle={authRow.senderHandle}
        secretPrompt={authRow.secretPrompt}
        answerShape={authRow.secretAnswerShape}
      />
    );
  }

  // ── Opened: load body + images and render the grace-window letter ─────────
  const [contentRow] = await db
    .select({ body: letters.body })
    .from(letters)
    .where(eq(letters.id, id))
    .limit(1);
  if (!contentRow) notFound();

  const imageRows = await db
    .select()
    .from(letterImages)
    .where(eq(letterImages.letterId, authRow.id))
    .orderBy(letterImages.position);

  const signedUrls = await mintLetterImageSignedUrls(
    imageRows.map((img) => img.storagePath)
  );
  const rowCaptions = imageRows.map((img) => img.caption ?? null);
  const { a: validUrls, b: validCaptions } = zipFilter(
    signedUrls,
    rowCaptions,
    (url): url is string => url !== null
  );

  return (
    <main className="min-h-screen p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 animate-rise-in">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden>←</span>
            <span>Dashboard</span>
          </Link>
        </div>

        <article
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-md animate-rise-in"
          style={{ animationDelay: "60ms" }}
          aria-label={`Letter: ${authRow.letterName}`}
        >
          <header className="border-b border-border bg-muted px-6 py-5 text-center">
            <div className="mb-3 flex justify-center">
              <Envelope state="open" className="h-14 w-14 text-wax" aria-hidden />
            </div>
            {authRow.letterName && (
              <h1 className="mb-2 font-serif text-xl font-semibold leading-snug text-foreground">
                {authRow.letterName}
              </h1>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              From{" "}
              <span className="font-mono font-medium text-foreground">
                @{authRow.senderHandle}
              </span>
            </p>
          </header>

          <div
            className="px-6 py-8 animate-unfold sm:px-10"
            style={{ animationDelay: "160ms" }}
          >
            <div className="whitespace-pre-wrap font-serif text-base leading-[1.85] tracking-[0.01em] text-foreground">
              {contentRow.body}
            </div>
          </div>

          {validUrls.length > 0 && (
            <div
              className="border-t border-border px-6 py-6 animate-rise-in sm:px-10"
              style={{ animationDelay: "260ms" }}
            >
              <PhotoGallery urls={validUrls} captions={validCaptions} />
            </div>
          )}

          <footer className="border-t border-border bg-muted/50 px-6 py-4 text-center">
            {authRow.expiresAt ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This letter is open until{" "}
                  <strong className="text-foreground">
                    <LocalDateTime date={authRow.expiresAt} />
                  </strong>{" "}
                  (<Countdown expiresAt={authRow.expiresAt} />). Keep it, and it
                  stays with you for good.
                </p>
                <KeepButton
                  letterId={authRow.id}
                  letterPath={`/dashboard/inbox/${authRow.id}`}
                />
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                A letter from @{authRow.senderHandle}.
              </p>
            )}
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 min-h-10 rounded-full bg-background/80"
              )}
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Back to dashboard
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}

function ExpiredInboxLetter({ senderHandle }: { senderHandle: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center animate-rise-in">
        <Envelope
          state="sealed"
          className="h-20 w-20 text-muted-foreground drop-shadow-[0_6px_18px_oklch(0_0_0/0.14)]"
          aria-hidden
        />
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            This letter slipped away.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The letter from @{senderHandle} was opened but not kept in time.
          </p>
        </div>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
        >
          <LayoutDashboard className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
