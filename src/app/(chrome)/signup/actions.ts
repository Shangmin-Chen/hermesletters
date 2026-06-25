"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isSafeLocalPath } from "@/lib/safe-path";
import { parseLetterPath } from "@/lib/letter-path";
import { db } from "@/db";
import { letters } from "@/db/schema";

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

  const whereClause =
    letterCoords.kind === "v2"
      ? eq(letters.publicId, letterCoords.publicId)
      : and(
          eq(letters.senderHandle, letterCoords.handle),
          eq(letters.receiverName, letterCoords.receiver),
          eq(letters.letterName, letterCoords.letterName)
        );

  const [letterRow] = await db
    .select({
      id: letters.id,
      claimToken: letters.claimToken,
      status: letters.status,
      openedAt: letters.openedAt,
      expiresAt: letters.expiresAt,
      savedBy: letters.savedBy,
    })
    .from(letters)
    .where(whereClause)
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

  // Mirror save/route.ts's full predicate set exactly:
  //   - status = 'opened'          → letter was claimed but not yet saved
  //   - opened_at IS NOT NULL      → confirm it was actually opened
  //   - claim_token = <cookieValue> → only the holder of the grace cookie
  //   - expires_at > now()         → still within the 24h grace window
  //   - saved_by IS NULL           → not yet saved
  // Any failure returns the same gate message — do NOT reveal which check failed.
  const now = new Date();
  const claimValid =
    cookieValue !== null &&
    cookieValue === letterRow.claimToken &&
    letterRow.status === "opened" &&
    letterRow.openedAt !== null &&
    letterRow.expiresAt !== null &&
    letterRow.expiresAt > now &&
    letterRow.savedBy === null;

  if (!claimValid) {
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
