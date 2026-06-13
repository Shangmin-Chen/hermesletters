import Link from "next/link";
import { getUser, getProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Envelope } from "@/components/brand/Envelope";

export default async function Home() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center text-center space-y-10 max-w-md w-full">
        {/* Brand mark */}
        <div className="animate-rise-in flex flex-col items-center gap-5">
          <Envelope
            state="sealed"
            className="w-20 h-20 text-ink animate-wax-pulse"
            aria-hidden
          />
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Send a Letter
          </span>
        </div>

        {/* Hero copy */}
        <div className="animate-rise-in space-y-3" style={{ animationDelay: "80ms" }}>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-snug">
            Some things deserve<br className="hidden sm:block" /> more than a text.
          </h1>
          <p className="text-base text-muted-foreground font-sans leading-relaxed max-w-sm mx-auto">
            Write something real. Seal it with a secret only they know.
            Share it once — it opens once.
          </p>
        </div>

        {/* CTA */}
        <div
          className="animate-rise-in flex flex-col items-center gap-3 w-full sm:flex-row sm:justify-center"
          style={{ animationDelay: "160ms" }}
        >
          {user ? (
            <Link
              href={profile ? "/dashboard" : "/onboarding"}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "bg-wax text-primary-foreground hover:bg-wax-deep transition-colors px-8 py-2.5 min-h-[44px] text-base font-medium rounded-full shadow-sm inline-flex items-center"
              )}
            >
              Open my letters
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "bg-wax text-primary-foreground hover:bg-wax-deep transition-colors px-8 py-2.5 min-h-[44px] text-base font-medium rounded-full shadow-sm inline-flex items-center"
                )}
              >
                Write your first letter
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "text-muted-foreground hover:text-ink px-6 text-sm min-h-[44px] inline-flex items-center"
                )}
              >
                Already have an account? Sign in
              </Link>
            </>
          )}
        </div>

        {/* Quiet tagline */}
        <p
          className="animate-rise-in text-xs text-muted-foreground font-sans tracking-wide"
          style={{ animationDelay: "240ms" }}
        >
          Open-once &middot; No read receipts &middot; Only the two of you
        </p>
      </div>
    </main>
  );
}
