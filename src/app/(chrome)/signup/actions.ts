"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { hasSignupClaimForLetterPath } from "@/server/letters/signup-claim";

type ActionState = { error?: string } | null;

export async function signUpAction(
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

  if (!next || !(await hasSignupClaimForLetterPath(next))) {
    return {
      error:
        "You can only sign up after you've received a letter.",
    };
  }

  // ── Create the account ─────────────────────────────────────────────────────
  //
  // NOTE: this assumes the Supabase project has "Confirm email" disabled. With
  // email confirmation off, signUp returns a session immediately and the user
  // can proceed straight into onboarding. If confirmation is re-enabled,
  // signUp will return a null session and the user will be stuck; make sure
  // to keep "Confirm email" disabled in the Supabase Auth settings.

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Neutralise account-existence disclosure: treat "already registered" /
    // "user_already_exists" identically to a generic sign-up error so an
    // attacker cannot enumerate registered addresses by trying to sign up.
    // Log the raw error server-side only — never leak internal detail to client.
    console.error("[signUpAction] Supabase signUp error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  // With "Confirm email" disabled, session is set immediately.
  // Route based on profile state: new user → onboarding (carrying next so they
  // return to their letter); existing profile → straight to next/dashboard.
  if (data.session) {
    const profile = await getProfile();
    if (profile) {
      redirect(next!);
    }
    redirect(`/onboarding?next=${encodeURIComponent(next!)}`);
  }

  // Should not reach here when "Confirm email" is disabled, but be safe.
  return {
    error:
      "Account created but sign-in failed. Please log in.",
  };
}
