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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header card */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Welcome back,{" "}
              <span className="font-medium text-foreground">
                {profile.display_name ?? profile.handle}
              </span>
              . Your handle is{" "}
              <span className="font-mono font-medium text-foreground">
                @{profile.handle}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Send mail CTA */}
            <Link
              href="/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full inline-flex justify-center"
              )}
            >
              Write a letter
            </Link>
            <form action="/auth/signout" method="POST">
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Received mail */}
        <Card>
          <CardHeader>
            <CardTitle>Received mail</CardTitle>
            <CardDescription>
              Letters you&apos;ve saved during the grace window — yours permanently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {receivedLetters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No letters yet. When you keep a letter during its 24-hour grace
                window, it will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {receivedLetters.map((letter) => {
                  const savedDate = letter.savedAt
                    ? new Date(letter.savedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <li key={letter.id} className="py-3">
                      <Link
                        href={`/dashboard/received/${letter.id}`}
                        className="group flex flex-col gap-0.5 hover:underline"
                      >
                        <span className="font-medium text-foreground group-hover:underline">
                          {letter.letterName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          From{" "}
                          <span className="font-mono">@{letter.senderHandle}</span>{" "}
                          &middot; to {letter.receiverName}
                          {savedDate && (
                            <> &middot; saved {savedDate}</>
                          )}
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
