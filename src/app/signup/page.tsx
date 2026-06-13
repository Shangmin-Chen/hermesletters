import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { SignupForm } from "./SignupForm";
import { Wordmark } from "@/components/brand/Wordmark";

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;

  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    if (profile) {
      redirect(next ?? "/dashboard");
    }
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="md" className="text-ink" />
          <h1 className="font-serif text-2xl font-semibold text-ink tracking-tight">
            Start writing
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your account — it only takes a moment.
          </p>
        </header>
        <SignupForm next={next} />
      </div>
    </main>
  );
}
