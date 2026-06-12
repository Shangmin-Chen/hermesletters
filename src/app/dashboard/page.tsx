import "server-only";
import { requireProfile } from "@/lib/auth";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/Wordmark";
import { Envelope } from "@/components/brand/Envelope";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();

  // ── Received mail — metadata only, no body ────────────────────────────────
  //
  // Guard: saved_by must equal user's id AND saved_at must be non-null.
  // The orphan caveat (drizzle/README.md): if a receiver's profile is deleted,
  // the row gets saved_by = NULL but status = 'saved'. We explicitly require
  // saved_by = profile.id AND saved_at IS NOT NULL so orphaned rows are excluded.
  const receivedLetters = await db
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
        isNotNull(letters.savedAt)
      )
    )
    .orderBy(desc(letters.savedAt));

  const greeting = profile.display_name ?? `@${profile.handle}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 pt-10 sm:p-6 sm:pt-14">
      <div className="w-full max-w-2xl space-y-6">

        {/* ── Header card ─────────────────────────────────────────────────── */}
        <Card className="animate-rise-in overflow-hidden border-border bg-card shadow-sm">
          {/* Warm top strip */}
          <div className="bg-muted border-b border-border px-6 py-3 flex items-center justify-between gap-3">
            <Wordmark size="sm" className="text-ink" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground font-mono">
                @{profile.handle}
              </span>
              <form action="/auth/signout" method="POST">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </Button>
              </form>
            </div>
          </div>

          <CardHeader className="pb-2 pt-5">
            <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug">
              Good to see you,{" "}
              <span className="text-wax">{greeting}</span>.
            </h1>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              Write something only one person will ever read — or revisit a
              letter that&apos;s already yours.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pb-6">
            {/* Primary CTA */}
            <Link
              href="/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full inline-flex justify-center gap-2 bg-wax text-primary-foreground hover:bg-wax-deep transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              <Envelope state="sealed" className="w-4 h-4 shrink-0" aria-hidden />
              Write a letter
            </Link>
          </CardContent>
        </Card>

        {/* ── Received mail ───────────────────────────────────────────────── */}
        <Card
          className="animate-rise-in overflow-hidden border-border bg-card shadow-sm"
          style={{ animationDelay: "80ms" }}
        >
          <CardHeader className="pb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Received mail
            </h2>
            <CardDescription className="text-sm text-muted-foreground">
              Letters you&apos;ve kept — yours permanently.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            {receivedLetters.length === 0 ? (
              /* ── Designed empty state ─────────────────────────────────── */
              <div className="flex flex-col items-center gap-5 py-10 px-4 text-center">
                {/* Illustrated open envelope */}
                <div className="relative">
                  <Envelope
                    state="open"
                    className="w-20 h-20 text-muted-foreground animate-rise-in"
                    aria-hidden
                  />
                </div>

                {/* Heading */}
                <div className="space-y-1.5 max-w-xs">
                  <h3 className="font-serif text-base font-semibold text-foreground leading-snug">
                    Your mailbox is waiting
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When someone sends you a letter and you keep it during the
                    24-hour window, it lives here — safe and permanent.
                  </p>
                </div>

                {/* Gentle nudge CTA */}
                <p className="text-xs text-muted-foreground">
                  In the meantime, why not{" "}
                  <Link
                    href="/new"
                    className="text-wax underline underline-offset-2 hover:text-wax/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                  >
                    write one yourself
                  </Link>
                  ? Someone&apos;s probably waiting to hear from you.
                </p>
              </div>
            ) : (
              /* ── Letter list ──────────────────────────────────────────── */
              <ul className="divide-y divide-border -mx-6 px-6">
                {receivedLetters.map((letter, i) => {
                  const savedDate = letter.savedAt
                    ? new Date(letter.savedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <li key={letter.id}>
                      <Link
                        href={`/dashboard/received/${letter.id}`}
                        className={cn(
                          "group flex items-start gap-3 py-3.5 rounded-sm",
                          "hover:bg-muted/60 active:bg-muted transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          "-mx-2 px-2",
                          "animate-rise-in"
                        )}
                        style={{ animationDelay: `${120 + i * 40}ms` }}
                      >
                        {/* Envelope icon */}
                        <Envelope
                          state="open"
                          className="w-8 h-8 shrink-0 mt-0.5 text-wax/70 group-hover:text-wax transition-colors"
                          aria-hidden
                        />

                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-serif font-semibold text-foreground text-sm leading-snug truncate group-hover:text-wax transition-colors">
                            {letter.letterName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            From{" "}
                            <span className="font-mono">@{letter.senderHandle}</span>
                            {" · "}to {letter.receiverName}
                            {savedDate && (
                              <> · kept {savedDate}</>
                            )}
                          </span>
                        </span>

                        {/* Chevron affordance */}
                        <span
                          className="ml-auto shrink-0 self-center text-muted-foreground group-hover:text-foreground transition-colors text-base leading-none"
                          aria-hidden
                        >
                          ›
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
