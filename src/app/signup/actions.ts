"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";

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

  // Fix 4: derive an absolute origin from request headers (Server Action context)
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host")
      ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
      : null) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  // Thread a validated `next` through the email-confirm callback so a
  // recipient who registers to read a letter lands back on it afterwards.
  const confirmRedirect = next
    ? `${origin}/auth/confirm?next=${encodeURIComponent(next)}`
    : `${origin}/auth/confirm`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmRedirect,
    },
  });

  if (error) {
    // Neutralise account-existence disclosure: treat "already registered" /
    // "user_already_exists" identically to a pending fresh signup so an
    // attacker cannot enumerate registered addresses. Do NOT branch on `next`
    // here — the neutral "check your email" path must look identical whether or
    // not the address already exists.
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists") ||
      error.code === "user_already_exists"
    ) {
      redirect("/signup/check-email");
    }
    return { error: error.message };
  }

  // Fix 6: if email confirmation is disabled, session is set immediately.
  // If the user already has a profile, honor `next` directly; otherwise send
  // them through onboarding, carrying `next` so they return to their letter.
  if (data.session) {
    const profile = await getProfile();
    if (profile && next) {
      redirect(next);
    }
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }

  // Confirmation pending — tell the user to check their email
  redirect("/signup/check-email");
}
