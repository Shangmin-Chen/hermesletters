import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeSecretAnswer, secretAnswerShape } from "@/lib/letter-secrets";

const ANSWER_HASH_VERSION = "v1";

function requiredPepper(): string {
  const pepper =
    process.env.LETTER_SECRET_PEPPER ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.CRON_SECRET ??
    process.env.DATABASE_URL;

  if (!pepper) {
    throw new Error(
      "LETTER_SECRET_PEPPER or another server secret is required to hash letter answers."
    );
  }

  return pepper;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashOpenToken(token: string): string {
  return createHash("sha256").update(`open-token:${token}`).digest("hex");
}

export function createOpenToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashOpenToken(token) };
}

function answerDigest(answer: string, salt: string): string {
  const normalized = normalizeSecretAnswer(answer);
  return createHmac("sha256", requiredPepper())
    .update(`${ANSWER_HASH_VERSION}:${salt}:${normalized}`)
    .digest("hex");
}

export function createSecretAnswer(answer: string): {
  answerHash: string;
  answerSalt: string;
  answerShape: string;
} {
  const answerSalt = randomBytes(16).toString("base64url");
  const answerHash = `${ANSWER_HASH_VERSION}:${answerDigest(answer, answerSalt)}`;

  return {
    answerHash,
    answerSalt,
    answerShape: secretAnswerShape(answer),
  };
}

export function verifySecretAnswer(
  guess: string,
  answerSalt: string | null,
  storedHash: string | null
): boolean {
  if (!answerSalt || !storedHash) return false;

  const expected = `${ANSWER_HASH_VERSION}:${answerDigest(guess, answerSalt)}`;
  return safeEqual(expected, storedHash);
}
