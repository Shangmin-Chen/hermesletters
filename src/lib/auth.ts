import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the current Supabase auth user or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user's profiles row or null. */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
}

/**
 * Require an authenticated user.
 * Redirects to /login if unauthenticated.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require an authenticated user with a profiles row.
 * Redirects to /login if unauthenticated.
 * Redirects to /onboarding if authenticated but no profile.
 */
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  return profile;
}
