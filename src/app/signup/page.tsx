import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    // Fix 7: route authenticated users based on profile state
    const profile = await getProfile();
    redirect(profile ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <SignupForm />
    </main>
  );
}
