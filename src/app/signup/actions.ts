"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type ActionState = { error?: string } | null;

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Fix 4: derive an absolute origin from request headers (Server Action context)
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host")
      ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
      : null) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    // Neutralise account-existence disclosure: treat "already registered" /
    // "user_already_exists" identically to a pending fresh signup so an
    // attacker cannot enumerate registered addresses.
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists") ||
      error.code === "user_already_exists"
    ) {
      redirect("/signup/check-email");
    }
    return { error: error.message };
  }

  // Fix 6: if email confirmation is disabled, session is set immediately — go straight to onboarding
  if (data.session) {
    redirect("/onboarding");
  }

  // Confirmation pending — tell the user to check their email
  redirect("/signup/check-email");
}
