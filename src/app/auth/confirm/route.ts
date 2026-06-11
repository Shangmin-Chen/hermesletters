import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Validate a redirect target is a safe local relative path.
 * Must start with a single "/", must NOT start with "//", must NOT contain "://".
 */
function isSafeLocalPath(next: string): boolean {
  return (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("://")
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "invite"
    | "email"
    | null;
  const rawNext = searchParams.get("next") ?? "/onboarding";
  const next = isSafeLocalPath(rawNext) ? rawNext : "/onboarding";

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

  return NextResponse.redirect(new URL(next, request.url));
}
