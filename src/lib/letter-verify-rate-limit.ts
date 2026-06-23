import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";

export const VERIFY_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_ATTEMPT_WINDOW_SECONDS = VERIFY_ATTEMPT_WINDOW_MS / 1000;
export const PER_LETTER_MAX_VERIFY_ATTEMPTS = 20;
export const PER_ACTOR_LETTER_MAX_VERIFY_ATTEMPTS = 5;

const ACTOR_KEY_VERSION = "v1";

type VerifyRateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "letter" | "actor" };

function requiredActorPepper(): string {
  const pepper =
    process.env.LETTER_SECRET_PEPPER ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.CRON_SECRET ??
    process.env.DATABASE_URL;

  if (!pepper) {
    throw new Error(
      "LETTER_SECRET_PEPPER or another server secret is required to hash verify rate-limit actors."
    );
  }

  return pepper;
}

function digestActor(kind: "invite" | "profile", material: string): string {
  const digest = createHmac("sha256", requiredActorPepper())
    .update(`${ACTOR_KEY_VERSION}:${kind}:${material}`)
    .digest("hex");

  return `${kind}:${ACTOR_KEY_VERSION}:${digest}`;
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function inviteVerifyActorKey(request: NextRequest): string {
  const ip =
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(request.headers.get("x-real-ip")) ||
    firstHeaderValue(request.headers.get("x-forwarded-for")) ||
    "unknown";
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";

  return digestActor("invite", `${ip}\n${userAgent}`);
}

export function profileVerifyActorKey(profileId: string): string {
  return digestActor("profile", profileId);
}

export async function recordVerifyAttemptWithinLimits({
  letterId,
  actorKey,
}: {
  letterId: string;
  actorKey: string;
}): Promise<VerifyRateLimitResult> {
  const rows = await db.execute<{
    allowed: boolean;
    scope: "letter" | "actor" | null;
  }>(sql`
    SELECT allowed, scope
    FROM public.record_letter_verify_attempt(
      ${letterId}::uuid,
      ${actorKey},
      ${VERIFY_ATTEMPT_WINDOW_SECONDS},
      ${PER_LETTER_MAX_VERIFY_ATTEMPTS},
      ${PER_ACTOR_LETTER_MAX_VERIFY_ATTEMPTS}
    )
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("Verify rate-limit function returned no result.");
  }

  if (!row.allowed) {
    return { allowed: false, scope: row.scope === "actor" ? "actor" : "letter" };
  }

  return { allowed: true };
}
