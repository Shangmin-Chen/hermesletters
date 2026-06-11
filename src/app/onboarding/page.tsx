import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile) redirect("/dashboard");

  // Derive the email local-part as a default display name hint
  const emailLocalPart = user.email?.split("@")[0] ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <OnboardingForm emailLocalPart={emailLocalPart} />
    </main>
  );
}
