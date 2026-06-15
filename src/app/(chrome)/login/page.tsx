import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { LoginForm } from "./LoginForm";

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
    <main className="flex flex-1 flex-col items-center justify-center p-4">
      <LoginForm next={next} />
    </main>
  );
}
