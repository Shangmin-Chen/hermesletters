import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getProfile, getUser } from "@/lib/auth";
import { isValidLetterPublicId } from "@/lib/letter-public-id";
import { saveLetterForProfile } from "@/server/letters/save-letter";
import { v2Error } from "@/app/api/v2/_lib/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  if (!isValidLetterPublicId(publicId)) {
    return v2Error("invalid_letter_id", "Letter id is invalid.", 400);
  }

  const user = await getUser();
  if (!user) {
    return v2Error("unauthenticated", "Authentication is required.", 401);
  }

  const profile = await getProfile();
  if (!profile) {
    return v2Error("profile_required", "A profile is required.", 403);
  }

  const result = await saveLetterForProfile({
    lookup: { kind: "publicId", publicId },
    request,
    userId: user.id,
    profileId: profile.id,
  });

  if (result.status === "cannot_save") {
    // Keep this intentionally generic: missing, expired, already saved, and
    // unauthorized letters all collapse to the same non-enumerating result.
    return v2Error("letter_not_saveable", "Letter cannot be saved.", 409);
  }

  return NextResponse.json({ data: { status: "saved" } }, { status: 201 });
}
