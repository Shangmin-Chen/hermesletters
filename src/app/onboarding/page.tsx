import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { OnboardingForm } from "./OnboardingForm";
import { Wordmark } from "@/components/brand/Wordmark";

interface OnboardingPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;

  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile) redirect(next ?? "/dashboard");

  const emailLocalPart = user.email?.split("@")[0] ?? "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="md" className="text-ink" />
          <h1 className="font-serif text-2xl font-semibold text-ink tracking-tight">
            One last thing
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Choose a handle — it becomes part of every link you send,
            and you can&apos;t change it later, so pick something you like.
          </p>
        </header>
        <OnboardingForm emailLocalPart={emailLocalPart} next={next} />
      </div>
    </main>
  );
}
