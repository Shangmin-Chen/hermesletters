import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { hasSignupClaimForLetterPath } from "@/server/letters/signup-claim";
import { SignupForm } from "./SignupForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;
  const letterNext =
    next && (await hasSignupClaimForLetterPath(next)) ? next : null;

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
