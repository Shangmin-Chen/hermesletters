import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { OnboardingForm } from "./OnboardingForm";

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
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <OnboardingForm emailLocalPart={emailLocalPart} next={next} />
    </main>
  );
}
