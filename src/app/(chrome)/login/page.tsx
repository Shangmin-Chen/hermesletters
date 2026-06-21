import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;

  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    if (profile) redirect(next ?? "/dashboard");
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4">
      <LoginForm next={next} />
    </main>
  );
}
