import "server-only";

import type { NextRequest, NextResponse } from "next/server";

export const CLAIM_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export type ClaimCookie = {
  name: string;
  value: string;
  secure: boolean;
  maxAge: number;
};

export function claimCookieName(identifier: string): string {
  return `claim:${identifier}`;
}

export function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  return forwardedProto === "https" || request.nextUrl.protocol === "https:";
}

export function readClaimCookie(request: NextRequest, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return (
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export function setClaimCookie(response: NextResponse, cookie: ClaimCookie): void {
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
}
