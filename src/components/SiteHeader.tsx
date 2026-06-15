import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUser, getProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Slim site-wide header: Wordmark home link on the left, auth controls on the right.
 * Logged-out: Sign in / Get started.
 * Logged-in: @handle + Sign out form (POST to /auth/signout).
 *
 * Rendered only in the (chrome) route-group layout, so letter-reading pages
 * ([handle]/[receiver]/[letter]) and dev previews never see this header.
 */
export async function SiteHeader() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
        {/* Left: wordmark — wrapped in Next Link for client-side navigation */}
        <Link href="/" aria-label="Hermes' Letters — home">
          <Wordmark size="sm" className="text-ink" />
        </Link>

        {/* Right: theme toggle + auth controls */}
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              {profile && (
                <span className="hidden text-sm text-muted-foreground sm:block">
                  @{profile.handle}
                </span>
              )}
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
