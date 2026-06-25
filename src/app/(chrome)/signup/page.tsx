import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { parseLetterPath } from "@/lib/letter-path";
import { SignupForm } from "./SignupForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { letters } from "@/db/schema";

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

async function hasSignupClaim(next: string): Promise<boolean> {
  const letterCoords = parseLetterPath(next);
  if (!letterCoords) return false;

  const whereClause =
    letterCoords.kind === "v2"
      ? eq(letters.publicId, letterCoords.publicId)
      : and(
          eq(letters.senderHandle, letterCoords.handle),
          eq(letters.receiverName, letterCoords.receiver),
          eq(letters.letterName, letterCoords.letterName)
        );

  const [letterRow] = await db
    .select({
      id: letters.id,
      claimToken: letters.claimToken,
      status: letters.status,
      openedAt: letters.openedAt,
      expiresAt: letters.expiresAt,
      savedBy: letters.savedBy,
    })
    .from(letters)
    .where(whereClause)
    .limit(1);

  if (!letterRow?.claimToken) return false;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(`claim:${letterRow.id}`)?.value ?? null;
  const now = new Date();

  return (
    cookieValue === letterRow.claimToken &&
    letterRow.status === "opened" &&
    letterRow.openedAt !== null &&
    letterRow.expiresAt !== null &&
    letterRow.expiresAt > now &&
    letterRow.savedBy === null
  );
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;
  const letterNext = next && (await hasSignupClaim(next)) ? next : null;

  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    if (profile) {
      redirect(letterNext ?? "/dashboard");
    }
    redirect(
      letterNext ? `/onboarding?next=${encodeURIComponent(letterNext)}` : "/onboarding"
    );
  }

  if (!letterNext) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card px-6 py-7 text-center shadow-sm animate-rise-in">
          <h1 className="font-serif text-xl font-semibold text-foreground">
            Hermes Letters is invite-only.
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You can create an account after opening a letter sent to you.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4">
      <SignupForm next={letterNext} />
    </main>
  );
}
