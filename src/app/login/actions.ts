"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";

type ActionState = { error?: string } | null;

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rawNext = formData.get("next");
  const next =
    typeof rawNext === "string" && isSafeLocalPath(rawNext) ? rawNext : null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Fix 8: map credential errors to a generic message to prevent email enumeration
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Please confirm your email address before logging in." };
    }
    // All other auth failures (invalid credentials, user not found, etc.) get a generic message
    return { error: "Invalid email or password." };
  }

  // If a safe local next path was provided, redirect there (e.g. back to a grace-window letter).
  // Otherwise fall back to profile-based routing.
  if (next) {
    redirect(next);
  }

  // Fix 7: route based on profile state — profile → dashboard, no profile → onboarding
  const profile = await getProfile();
  if (profile) {
    redirect("/dashboard");
  } else {
    redirect("/onboarding");
  }
}
