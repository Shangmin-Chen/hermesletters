import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbSelectMock = vi.hoisted(() => vi.fn());
const getUserAndProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    select: dbSelectMock,
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserAndProfile: getUserAndProfileMock,
}));

import { GET } from "@/app/api/handles/check/route";

function requestFor(handle: string) {
  return new NextRequest(
    `https://hermesletters.test/api/handles/check?handle=${encodeURIComponent(handle)}`
  );
}

describe("handle availability route", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    getUserAndProfileMock.mockReset();
  });

  it("refuses unauthenticated callers before checking profiles", async () => {
    getUserAndProfileMock.mockResolvedValue({ user: null, profile: null });

    const response = await GET(requestFor("alice"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ available: false });
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it("refuses already-onboarded callers before checking profiles", async () => {
    getUserAndProfileMock.mockResolvedValue({
      user: { id: "user-1" },
      profile: { id: "user-1", handle: "existing" },
    });

    const response = await GET(requestFor("alice"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ available: false });
    expect(dbSelectMock).not.toHaveBeenCalled();
  });
});
