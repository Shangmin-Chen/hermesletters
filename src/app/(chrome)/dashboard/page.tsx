import "server-only";
import { requireProfile } from "@/lib/auth";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
            <Link
              href="/phonebook"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto"
              )}
            >
              Phonebook
            </Link>
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
                    <li key={letter.id}>
                      <Link
                        href={`/dashboard/received/${letter.id}`}
                        className="block py-4 transition-colors hover:text-primary"
                      >
                        <p className="font-medium">{letter.letterName}</p>
                        <p className="text-sm text-muted-foreground">
                          From @{letter.senderHandle} to {letter.receiverName}
                          {savedDate ? ` · kept ${savedDate}` : ""}
                        </p>
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
