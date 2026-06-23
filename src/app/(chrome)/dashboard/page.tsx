import "server-only";
import { requireProfile } from "@/lib/auth";
import { hasUnseenConnections } from "@/lib/connections";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { eq, and, isNotNull, isNull, desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { Envelope } from "@/components/brand/Envelope";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArchiveKeptLetterButton } from "./ArchiveKeptLetterButton";
import { RestoreKeptLetterButton } from "./RestoreKeptLetterButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();

  const [receivedLetters, archivedLetters, inbox, showConnectionDot] =
    await Promise.all([
    // ── Kept letters — metadata only, no body. Active (non-archived) only ────
    //
    // Guard: saved_by must equal user's id AND saved_at must be non-null.
    // The orphan caveat (drizzle/README.md): if a receiver's profile is deleted,
    // the row gets saved_by = NULL but status = 'saved'. We explicitly require
    // saved_by = profile.id AND saved_at IS NOT NULL so orphaned rows are excluded.
    // archived_at IS NULL keeps archived letters out of the kept list.
    db
      .select({
        id: letters.id,
        senderHandle: letters.senderHandle,
        receiverName: letters.receiverName,
        letterName: letters.letterName,
        savedAt: letters.savedAt,
      })
      .from(letters)
      .where(
        and(
          eq(letters.savedBy, profile.id),
          isNotNull(letters.savedAt),
          isNull(letters.archivedAt)
        )
      )
      .orderBy(desc(letters.savedAt)),

    // ── Archived letters — same ownership guard, but archived_at IS NOT NULL ──
    db
      .select({
        id: letters.id,
        senderHandle: letters.senderHandle,
        receiverName: letters.receiverName,
        letterName: letters.letterName,
        archivedAt: letters.archivedAt,
      })
      .from(letters)
      .where(
        and(
          eq(letters.savedBy, profile.id),
          isNotNull(letters.savedAt),
          isNotNull(letters.archivedAt)
        )
      )
      .orderBy(desc(letters.archivedAt)),

    // ── You've got mail — direct letters addressed to me (metadata only) ────
    db
      .select({
        id: letters.id,
        senderHandle: letters.senderHandle,
        letterName: letters.letterName,
        status: letters.status,
        createdAt: letters.createdAt,
      })
      .from(letters)
      .where(
        and(
          eq(letters.receiverId, profile.id),
          inArray(letters.status, ["unopened", "opened", "expired"])
        )
      )
      .orderBy(desc(letters.createdAt)),

    // New-connection red dot (cleared when the user visits the phonebook).
    hasUnseenConnections(
      profile.id,
      profile.connections_seen_at ?? null
    ),
  ]);

  const unreadCount = inbox.filter((m) => m.status === "unopened").length;

  const greeting = profile.display_name ?? profile.handle;

  return (
    <main className="flex flex-1 flex-col items-center p-4 pt-10 sm:p-6">
      <div className="w-full max-w-2xl space-y-6 animate-rise-in">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Welcome back, {greeting}
            </CardTitle>
            <CardDescription>
              Write a private letter or revisit one you&apos;ve kept.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href="/new"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              Write a letter
            </Link>
            <span className="relative inline-flex w-full sm:w-auto">
              <Link
                href="/phonebook"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full sm:w-auto"
                )}
              >
                Phonebook
              </Link>
              {showConnectionDot && (
                <span
                  className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  aria-label="New connection"
                />
              )}
            </span>
          </CardContent>
        </Card>

        {/* ── You've got mail — direct letters from connections ─────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-serif text-xl">
                You&apos;ve got mail
              </CardTitle>
              {unreadCount > 0 && (
                <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground">
                  {unreadCount} new
                </span>
              )}
            </div>
            <CardDescription>
              Letters sent straight to you by your connections.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No mail yet. When a connection writes you directly, it lands here.
              </p>
            ) : (
              <ul className="divide-y">
                {inbox.map((mail) => {
                  const unopened = mail.status === "unopened";
                  const expired = mail.status === "expired";
                  return (
                    <li key={mail.id}>
                      <Link
                        href={`/dashboard/inbox/${mail.id}`}
                        className="flex items-center gap-3 py-4 transition-colors hover:text-primary"
                      >
                        <Envelope
                          state={unopened ? "sealed" : "open"}
                          className={cn(
                            "size-8 shrink-0",
                            unopened ? "text-wax" : "text-muted-foreground"
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0">
                        <p className="flex items-baseline gap-1 min-w-0 font-medium">
                          <span className="min-w-0 truncate" title={mail.letterName}>
                            {mail.letterName}
                          </span>
                          {unopened && (
                            <span className="shrink-0 align-middle text-xs font-normal text-wax">
                              · sealed
                            </span>
                          )}
                          {expired && (
                            <span className="shrink-0 align-middle text-xs font-normal text-muted-foreground">
                              · expired
                            </span>
                          )}
                        </p>
                          <p className="truncate text-sm text-muted-foreground">
                            From @{mail.senderHandle}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-serif text-xl">Kept letters</CardTitle>
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {receivedLetters.length}
              </span>
            </div>
            <CardDescription>
              Letters you saved after opening.
              {archivedLetters.length > 0 &&
                " Archived letters are listed separately below."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {receivedLetters.length === 0 ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  No kept letters yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Letters you send aren&apos;t kept here — only letters you open
                  and choose to keep will appear in this list.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {receivedLetters.map((letter) => {
                  const savedDate = letter.savedAt
                    ? new Date(letter.savedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <li
                      key={letter.id}
                      className="relative flex items-center gap-3 py-4"
                    >
                      {/* Stretched link covers the row; the archive button sits
                          above it (relative z-10) so it stays clickable. */}
                      <Link
                        href={`/dashboard/received/${letter.id}`}
                        className="min-w-0 flex-1 transition-colors hover:text-primary after:absolute after:inset-0 after:content-['']"
                      >
                        <p className="truncate font-medium" title={letter.letterName}>
                          {letter.letterName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          From @{letter.senderHandle} to {letter.receiverName}
                          {savedDate ? ` · kept ${savedDate}` : ""}
                        </p>
                      </Link>
                      <div className="relative z-10 shrink-0">
                        <ArchiveKeptLetterButton
                          letterId={letter.id}
                          letterName={letter.letterName}
                          compact
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Archived letters — secondary, only when present ─────────────── */}
        {archivedLetters.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-serif text-xl text-muted-foreground">
                  Archived
                </CardTitle>
                <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                  {archivedLetters.length}
                </span>
              </div>
              <CardDescription>
                Letters you archived. Restore one to move it back to your kept
                list.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="divide-y">
                {archivedLetters.map((letter) => (
                  <li
                    key={letter.id}
                    className="relative flex items-center gap-3 py-4"
                  >
                    <Link
                      href={`/dashboard/received/${letter.id}`}
                      className="min-w-0 flex-1 transition-colors hover:text-primary after:absolute after:inset-0 after:content-['']"
                    >
                      <p
                        className="truncate font-medium text-muted-foreground"
                        title={letter.letterName}
                      >
                        {letter.letterName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        From @{letter.senderHandle} to {letter.receiverName}
                      </p>
                    </Link>
                    <div className="relative z-10 shrink-0">
                      <RestoreKeptLetterButton
                        letterId={letter.id}
                        letterName={letter.letterName}
                        compact
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
