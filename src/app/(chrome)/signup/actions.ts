"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { db } from "@/db";
import { letters } from "@/db/schema";

type ActionState = { error?: string } | null;

/**
 * Parse a letter URL path of the form `/{handle}/{receiver}/{letterName}` into
 * its three components. Returns null if the path doesn't match the expected
 * three-segment structure.
 */
function parseLetterPath(
  path: string
): { handle: string; receiver: string; letterName: string } | null {
  // Path must be /handle/receiver/letterName — exactly 3 non-empty segments.
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  const [handle, receiver, letterName] = parts;
  if (!handle || !receiver || !letterName) return null;
  return { handle, receiver, letterName };
}

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

  // ── Recipient-only gate ────────────────────────────────────────────────────
  //
  // Signup is only allowed for people who have unlocked a letter. We verify
  // this by:
  //   1. Parsing `next` into its (handle, receiver, letterName) URL triple.
  //   2. Looking up the letter row in the DB (Drizzle, no RLS).
  //   3. Checking that the browser holds a `claim:{letterId}` cookie whose value
  //      equals `letters.claim_token` — the same proof the save route trusts.
  //
  // If any step fails, we reject with a friendly message rather than leaking
  // which specific check failed.

  const letterCoords = next ? parseLetterPath(next) : null;

  if (!letterCoords) {
    return {
      error:
        "You can only sign up after you've received a letter.",
    };
  }

  const { handle, receiver, letterName } = letterCoords;

  const [letterRow] = await db
    .select({ id: letters.id, claimToken: letters.claimToken })
    .from(letters)
    .where(
      and(
        eq(letters.senderHandle, handle),
        eq(letters.receiverName, receiver),
        eq(letters.letterName, letterName)
      )
    )
    .limit(1);

  if (!letterRow || !letterRow.claimToken) {
    return {
      error:
        "You can only sign up after you've received a letter.",
    };
  }

  // Read the httpOnly claim cookie — same contract as the save route.
  const cookieStore = await cookies();
  const cookieName = `claim:${letterRow.id}`;
  const cookieValue = cookieStore.get(cookieName)?.value ?? null;

  if (!cookieValue || cookieValue !== letterRow.claimToken) {
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
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists") ||
      error.code === "user_already_exists"
    ) {
      // Return the same friendly gate message — do NOT leak that the email
      // is already in use, and do NOT redirect anywhere useful.
      return {
        error:
          "Something went wrong. If you already have an account, please log in.",
      };
    }
    return { error: error.message };
  }

  // With "Confirm email" disabled, session is set immediately.
  // Route based on profile state: new user → onboarding (carrying next so they
  // return to their letter); existing profile → straight to next/dashboard.
  if (data.session) {
    const profile = await getProfile();
    if (profile && next) {
      redirect(next);
    }
    redirect(
      next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding"
    );
  }

  // Should not reach here when "Confirm email" is disabled, but be safe.
  return {
    error:
      "Account created but sign-in failed. Please log in.",
  };
}
