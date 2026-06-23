import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import {
  inviteVerifyActorKey,
  profileVerifyActorKey,
} from "@/lib/letter-verify-rate-limit";

const originalPepper = process.env.LETTER_SECRET_PEPPER;

beforeEach(() => {
  process.env.LETTER_SECRET_PEPPER = "vitest-rate-limit-pepper";
});

afterEach(() => {
  if (originalPepper === undefined) {
    delete process.env.LETTER_SECRET_PEPPER;
  } else {
    process.env.LETTER_SECRET_PEPPER = originalPepper;
  }
});

describe("verify rate-limit actor keys", () => {
  it("keys invite actors with a stable HMAC without exposing raw request metadata", () => {
    const request = {
      headers: new Headers({
        "x-forwarded-for": "203.0.113.10, 198.51.100.7",
        "user-agent": "Vitest Browser",
      }),
    };

    const key = inviteVerifyActorKey(request as never);

    expect(key).toMatch(/^invite:v1:[a-f0-9]{64}$/);
    expect(key).toBe(inviteVerifyActorKey(request as never));
    expect(key).not.toContain("203.0.113.10");
    expect(key).not.toContain("Vitest Browser");
  });

  it("keys direct-letter actors with a stable HMAC without exposing profile ids", () => {
    const profileId = "11111111-2222-4333-8444-555555555555";
    const key = profileVerifyActorKey(profileId);

    expect(key).toMatch(/^profile:v1:[a-f0-9]{64}$/);
    expect(key).toBe(profileVerifyActorKey(profileId));
    expect(key).not.toContain(profileId);
    expect(profileVerifyActorKey("different-profile")).not.toBe(key);
  });
});
