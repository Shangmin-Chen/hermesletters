import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { slugify, isValidHandle } from "@/lib/slugify";
import { RESERVED_HANDLES } from "@/lib/reserved-handles";

/**
 * GET /api/handles/check?handle=<handle>
 *
 * Returns ONLY a boolean availability status — never any profile data —
 * so there is no information leakage beyond "taken / available / reserved".
 *
 * The same slugify + reserved-handle logic from the onboarding action is
 * applied here so client feedback exactly matches what the server will enforce.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("handle") ?? "";
  const handle = slugify(raw);

  // Invalid or empty handle — not available
  if (!handle || !isValidHandle(handle)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  // Reserved handle
  if (RESERVED_HANDLES.has(handle)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  // Check database for an existing profile with this handle
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.handle, handle))
    .limit(1);

  if (existing) {
    return NextResponse.json({ available: false, reason: "taken" });
  }

  return NextResponse.json({ available: true, reason: "available" });
}
