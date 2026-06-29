import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createOpenToken,
  createSecretAnswer,
  hashOpenToken,
  verifySecretAnswer,
} from "@/lib/letter-security";
import { parseLetterPath } from "@/lib/letter-path";
import { isSafeLocalPath } from "@/lib/safe-path";
import { isValidHandle, slugify } from "@/lib/slugify";

const secretEnvKeys = [
  "LETTER_SECRET_PEPPER",
  "SUPABASE_SECRET_KEY",
  "CRON_SECRET",
  "DATABASE_URL",
] as const;

const originalEnv = new Map<string, string | undefined>();

for (const key of secretEnvKeys) {
  originalEnv.set(key, process.env[key]);
}

function clearSecretEnv() {
  for (const key of secretEnvKeys) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearSecretEnv();
  process.env.LETTER_SECRET_PEPPER = "vitest-letter-pepper";
});

afterEach(() => {
  clearSecretEnv();
  for (const [key, value] of originalEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("letter-security", () => {
  it("hashes open tokens with a stable domain-separated digest", () => {
    const token = "visible-open-token";
    const expected = createHash("sha256").update(`open-token:${token}`).digest("hex");

    expect(hashOpenToken(token)).toBe(expected);
    expect(hashOpenToken(token)).not.toContain(token);
    expect(hashOpenToken("different-token")).not.toBe(expected);
  });

  it("creates random open tokens and stores only their hash", () => {
    const first = createOpenToken();
    const second = createOpenToken();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(first.tokenHash).toBe(hashOpenToken(first.token));
    expect(first.tokenHash).not.toBe(first.token);
    expect(second.token).not.toBe(first.token);
  });

  it("verifies shared-secret answers using normalized input and rejects mismatches", () => {
    const secret = createSecretAnswer("  Blue Door  ");

    expect(secret.answerHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(secret.answerSalt.length).toBeGreaterThan(16);
    expect(secret.answerShape).toBe("____ ____");
    expect(verifySecretAnswer("blue door", secret.answerSalt, secret.answerHash)).toBe(true);
    expect(verifySecretAnswer("  BLUE DOOR  ", secret.answerSalt, secret.answerHash)).toBe(true);
    expect(verifySecretAnswer("blue window", secret.answerSalt, secret.answerHash)).toBe(false);
    expect(verifySecretAnswer("blue door", "wrong-salt", secret.answerHash)).toBe(false);
    expect(verifySecretAnswer("blue door", secret.answerSalt, null)).toBe(false);
    expect(verifySecretAnswer("blue door", null, secret.answerHash)).toBe(false);
  });

  it("requires a server-side pepper before hashing shared-secret answers", () => {
    clearSecretEnv();

    expect(() => createSecretAnswer("answer")).toThrow(/server secret is required/);
  });
});

describe("isSafeLocalPath", () => {
  it.each([
    ["/", true],
    ["/dashboard", true],
    ["/login?next=%2Fdashboard", true],
    ["/letters/alice/bob#open", true],
    ["", false],
    ["dashboard", false],
    ["https://evil.example/path", false],
    ["//evil.example/path", false],
    ["/\\evil.example", false],
    ["/foo\\@evil.example", false],
    ["/foo://evil.example", false],
    ["/foo\nbar", false],
    ["/foo\u0000bar", false],
  ])("returns %s for %j", (path, expected) => {
    expect(isSafeLocalPath(path)).toBe(expected);
  });
});

describe("parseLetterPath", () => {
  it.each([
    ["/l/ltr_abcdefghijklmnopqrstuvwx", { kind: "v2", publicId: "ltr_abcdefghijklmnopqrstuvwx" }],
    [
      "/l/ltr_abcdefghijklmnopqrstuvwx?t=open-token#keep",
      { kind: "v2", publicId: "ltr_abcdefghijklmnopqrstuvwx" },
    ],
    [
      "/alice/bob/birthday?t=open-token",
      {
        kind: "legacy",
        handle: "alice",
        receiver: "bob",
        letterName: "birthday",
      },
    ],
  ])("parses %j", (path, expected) => {
    expect(parseLetterPath(path)).toEqual(expected);
  });
});

describe("slugify and handle validation", () => {
  it("normalizes handles without preserving illegal characters", () => {
    expect(slugify("  Alice In Wonderland!  ")).toBe("alice-in-wonderland");
    expect(slugify("__Double--Dash__")).toBe("double-dash");
    expect(slugify("MiXeD\tSpacing")).toBe("mixed-spacing");
    expect(slugify("!!!")).toBe("");
  });

  it("accepts only slug handles with alphanumeric edges", () => {
    expect(isValidHandle("a")).toBe(true);
    expect(isValidHandle("alice")).toBe(true);
    expect(isValidHandle("alice-letters-42")).toBe(true);
    expect(isValidHandle("-alice")).toBe(false);
    expect(isValidHandle("alice-")).toBe(false);
    expect(isValidHandle("alice_letters")).toBe(false);
    expect(isValidHandle("alice letters")).toBe(false);
    expect(isValidHandle("")).toBe(false);
  });
});
