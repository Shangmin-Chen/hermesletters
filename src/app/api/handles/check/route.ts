import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getUserAndProfile } from "@/lib/auth";
import { slugify, isValidHandle } from "@/lib/slugify";
import { RESERVED_HANDLES } from "@/lib/reserved-handles";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_SWEEP_MS = 5 * RATE_LIMIT_WINDOW_MS;
const RATE_LIMIT_SALT = randomBytes(16).toString("hex");

type RateLimitBucket = {
  windowStart: number;
  count: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let lastRateLimitSweep = 0;

/**
 * GET /api/handles/check?handle=<handle>
 *
 * Returns ONLY a boolean availability status — never any profile data —
 * so there is no information leakage beyond "unavailable / available / reserved".
 *
 * The same slugify + reserved-handle logic from the onboarding action is
 * applied here so client feedback exactly matches what the server will enforce.
 */
export async function GET(request: NextRequest) {
  const { user, profile } = await getUserAndProfile();
  if (!user) {
    return handleCheckJson({ available: false }, { status: 401 });
  }

  if (profile) {
    return handleCheckJson({ available: false }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, user.id);
  if (!rateLimit.allowed) {
    return handleCheckJson(
      { available: false },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const raw = request.nextUrl.searchParams.get("handle") ?? "";
  const handle = slugify(raw);

  // Invalid or empty handle — not available
  if (!handle || !isValidHandle(handle)) {
    return handleCheckJson({ available: false, reason: "unavailable" });
  }

  // Reserved handle
  if (RESERVED_HANDLES.has(handle)) {
    return handleCheckJson({ available: false, reason: "reserved" });
  }

  // Check database for an existing profile with this handle
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.handle, handle))
    .limit(1);

  if (existing) {
    return handleCheckJson({ available: false, reason: "unavailable" });
  }

  return handleCheckJson({ available: true, reason: "available" });
}

function handleCheckJson(
  body: { available: boolean; reason?: "available" | "reserved" | "unavailable" },
  init?: ResponseInit
) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function checkRateLimit(
  request: NextRequest,
  userId: string
):
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  sweepOldRateLimitBuckets(now);

  const key = getRateLimitKey(request, userId);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true };
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
      ),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

function getRateLimitKey(request: NextRequest, userId: string): string {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientIp =
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";

  // Keep only a salted, process-local digest in memory; never retain the raw IP.
  return createHash("sha256")
    .update(RATE_LIMIT_SALT)
    .update(":")
    .update(userId)
    .update(":")
    .update(clientIp)
    .digest("hex");
}

function sweepOldRateLimitBuckets(now: number) {
  if (now - lastRateLimitSweep < RATE_LIMIT_SWEEP_MS) return;
  lastRateLimitSweep = now;

  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.windowStart >= RATE_LIMIT_SWEEP_MS) {
      rateLimitBuckets.delete(key);
    }
  }
}
