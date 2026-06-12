import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/brand/Wordmark";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    redirect(profile ? "/dashboard" : "/onboarding");
  }

  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="md" className="text-ink" />
          <h1 className="font-serif text-2xl font-semibold text-ink tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Your letters are waiting.
          </p>
        </header>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
