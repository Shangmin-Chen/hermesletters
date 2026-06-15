import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSafeLocalPath } from "@/lib/safe-path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "invite"
    | "email"
    | null;
  const rawNext = searchParams.get("next");
  // Only honor a safe local path; anything else (open-redirect attempts, etc.)
  // is dropped so we fall back to profile-based routing.
  const next = rawNext && isSafeLocalPath(rawNext) ? rawNext : null;

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // The OTP verification established a session on `supabase`. Route based on
  // profile state: an existing profile goes straight to `next` (their letter);
  // a brand-new user goes through onboarding, carrying `next` so they return
  // to their letter once their profile is created.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasProfile = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    hasProfile = !!profile;
  }

  if (hasProfile) {
    return NextResponse.redirect(new URL(next ?? "/dashboard", request.url));
  }

  const onboardingPath = next
    ? `/onboarding?next=${encodeURIComponent(next)}`
    : "/onboarding";
  return NextResponse.redirect(new URL(onboardingPath, request.url));
}
