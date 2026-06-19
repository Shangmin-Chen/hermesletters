import Link from "next/link";
import { getUser, getProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { letters } from "@/db/schema";
import { count, isNotNull } from "drizzle-orm";

export const revalidate = 60;

export default async function Home() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  // delivered = opened letters (openedAt not null)
  const [{ delivered }] = await db
    .select({ delivered: count() })
    .from(letters)
    .where(isNotNull(letters.openedAt));

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8 text-center animate-rise-in">
        <div className="space-y-4">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
            Write a private letter.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Lock it behind a secret only they know.
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            It opens once — for the one person it was meant for, then it&apos;s gone.
          </p>
          <p className="text-sm text-muted-foreground">
            Hermes has delivered {delivered.toLocaleString()}{" "}
            {delivered === 1 ? "letter" : "letters"}.
          </p>
        </div>

        {/* Three-beat explanation */}
        <div className="flex items-start justify-center gap-6 text-sm text-muted-foreground sm:gap-10">
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-serif text-2xl text-ink">✦</span>
            <span className="font-medium text-foreground">Write</span>
            <span>Compose your letter, as long as it needs to be.</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-serif text-2xl text-ink">⊙</span>
            <span className="font-medium text-foreground">Seal</span>
            <span>Lock it with a secret only the two of you know.</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-serif text-2xl text-ink">◌</span>
            <span className="font-medium text-foreground">Once</span>
            <span>They open it once. Then it&apos;s gone forever.</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <Link
              href={profile ? "/dashboard" : "/onboarding"}
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              Go to dashboard
            </Link>
          ) : (
            // Hermes is invite-only: there is no signup entry point here. You can
            // only create an account by keeping a letter someone sent you. Existing
            // users can still sign in.
            <div className="flex flex-col items-center gap-3">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full sm:w-auto"
                )}
              >
                Sign in
              </Link>
              <p className="text-sm text-muted-foreground">
                Hermes is invite-only — you join by keeping a letter someone sends you.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
