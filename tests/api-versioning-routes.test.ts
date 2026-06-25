import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const claimInviteLetterMock = vi.hoisted(() => vi.fn());
const saveLetterForProfileMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const getProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/letters/claim-invite-letter", () => ({
  claimInviteLetter: claimInviteLetterMock,
}));

vi.mock("@/server/letters/save-letter", () => ({
  saveLetterForProfile: saveLetterForProfileMock,
}));

vi.mock("@/lib/auth", () => ({
  getUser: getUserMock,
  getProfile: getProfileMock,
}));

import { POST as legacyVerify } from "@/app/api/letters/[id]/verify/route";
import { POST as legacySave } from "@/app/api/letters/[id]/save/route";
import { POST as v2OpenClaim } from "@/app/api/v2/letters/[publicId]/open-claims/route";
import { POST as v2Save } from "@/app/api/v2/letters/[publicId]/saves/route";
import { claimCookieName } from "@/server/letters/claim-cookie";

const VALID_PUBLIC_ID = "ltr_abcdefghijklmnopqrstuvwx";

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawPostRequest(url: string, body: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("API versioning compatibility", () => {
  beforeEach(() => {
    claimInviteLetterMock.mockReset();
    saveLetterForProfileMock.mockReset();
    getUserMock.mockReset();
    getProfileMock.mockReset();
  });

  it("keeps the legacy verify route on id lookup with the legacy response shape", async () => {
    claimInviteLetterMock.mockResolvedValue({
      status: "unlocked",
      cookie: {
        name: "claim:letter-1",
        value: "claim-token",
        secure: true,
        maxAge: 86400,
      },
    });

    const response = await legacyVerify(
      jsonRequest("https://hermesletters.test/api/letters/letter-1/verify", {
        token: "open-token",
        guess: "blue door",
      }),
      { params: Promise.resolve({ id: "letter-1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "unlocked" });
    expect(response.headers.get("set-cookie")).toContain("claim:letter-1=claim-token");
    expect(claimInviteLetterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: { kind: "id", id: "letter-1" },
        token: "open-token",
        guess: "blue door",
      })
    );
  });

  it("uses public_id lookup and a v2 response envelope for open claims", async () => {
    claimInviteLetterMock.mockResolvedValue({
      status: "unlocked",
      cookie: {
        name: "claim:letter-1",
        value: "claim-token",
        secure: true,
        maxAge: 86400,
      },
    });

    const response = await v2OpenClaim(
      jsonRequest(
        `https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/open-claims`,
        { token: "open-token", answer: "blue door" }
      ),
      { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) }
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { status: "claimed" } });
    expect(response.headers.get("set-cookie")).toContain("claim:letter-1=claim-token");
    expect(claimInviteLetterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: { kind: "publicId", publicId: VALID_PUBLIC_ID },
        token: "open-token",
        guess: "blue door",
      })
    );
  });

  it("keeps the legacy save route on id lookup with the legacy response shape", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1" });
    saveLetterForProfileMock.mockResolvedValue({ status: "cannot_save" });

    const response = await legacySave(
      jsonRequest("https://hermesletters.test/api/letters/letter-1/save", {}),
      { params: Promise.resolve({ id: "letter-1" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "cannot_save" });
    expect(saveLetterForProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: { kind: "id", id: "letter-1" },
        userId: "user-1",
        profileId: "user-1",
      })
    );
  });

  it("uses public_id lookup and a v2 response envelope for saves", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1" });
    saveLetterForProfileMock.mockResolvedValue({ status: "saved" });

    const response = await v2Save(
      jsonRequest(
        `https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/saves`,
        {}
      ),
      { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) }
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { status: "saved" } });
    expect(saveLetterForProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: { kind: "publicId", publicId: VALID_PUBLIC_ID },
        userId: "user-1",
        profileId: "user-1",
      })
    );
  });

  it("keeps claim cookies in the internal id namespace shared by UI consumers", () => {
    expect(claimCookieName("letter-1")).toBe("claim:letter-1");
  });

  it("rejects malformed v2 public ids before touching the claim service", async () => {
    const response = await v2OpenClaim(
      jsonRequest("https://hermesletters.test/api/v2/letters/not-valid/open-claims", {
        token: "open-token",
        answer: "blue door",
      }),
      { params: Promise.resolve({ publicId: "not-valid" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_letter_id", message: "Letter id is invalid." },
    });
    expect(claimInviteLetterMock).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", rawPostRequest(
      `https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/open-claims`,
      "{"
    )],
    ["missing fields", jsonRequest(
      `https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/open-claims`,
      { token: "open-token" }
    )],
  ])("rejects v2 open-claim invalid requests: %s", async (_label, request) => {
    const response = await v2OpenClaim(request, {
      params: Promise.resolve({ publicId: VALID_PUBLIC_ID }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_request", message: expect.any(String) },
    });
    expect(claimInviteLetterMock).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "letter_not_found", "Letter was not found."],
    ["invalid_link", 404, "letter_not_found", "Letter was not found."],
    ["expired", 410, "letter_expired", "Letter has expired."],
    [
      "already_opened",
      409,
      "letter_already_opened",
      "Letter has already been opened.",
    ],
    ["incorrect", 422, "incorrect_answer", "Answer is incorrect."],
    ["rate_limited", 429, "rate_limited", "Too many attempts."],
  ])(
    "maps v2 open-claim %s to the documented error envelope",
    async (serviceStatus, httpStatus, code, message) => {
      claimInviteLetterMock.mockResolvedValue({ status: serviceStatus });

      const response = await v2OpenClaim(
        jsonRequest(
          `https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/open-claims`,
          { token: "open-token", answer: "blue door" }
        ),
        { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) }
      );

      expect(response.status).toBe(httpStatus);
      expect(await response.json()).toEqual({ error: { code, message } });
    }
  );

  it("rejects malformed v2 save public ids before auth or save logic", async () => {
    const response = await v2Save(
      jsonRequest("https://hermesletters.test/api/v2/letters/not-valid/saves", {}),
      { params: Promise.resolve({ publicId: "not-valid" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_letter_id", message: "Letter id is invalid." },
    });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(saveLetterForProfileMock).not.toHaveBeenCalled();
  });

  it("returns a v2 unauthenticated save envelope before profile or save logic", async () => {
    getUserMock.mockResolvedValue(null);

    const response = await v2Save(
      jsonRequest(`https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/saves`, {}),
      { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated", message: "Authentication is required." },
    });
    expect(getProfileMock).not.toHaveBeenCalled();
    expect(saveLetterForProfileMock).not.toHaveBeenCalled();
  });

  it("returns a v2 profile-required save envelope before save logic", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue(null);

    const response = await v2Save(
      jsonRequest(`https://hermesletters.test/api/v2/letters/${VALID_PUBLIC_ID}/saves`, {}),
      { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required", message: "A profile is required." },
    });
    expect(saveLetterForProfileMock).not.toHaveBeenCalled();
  });
});
