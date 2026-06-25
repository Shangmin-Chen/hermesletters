import "server-only";

import { randomBytes } from "node:crypto";

const PUBLIC_ID_BYTES = 18;
const PUBLIC_ID_PREFIX = "ltr";
const PUBLIC_ID_PATTERN = /^ltr_[A-Za-z0-9_-]{16,64}$/;

export function createLetterPublicId(): string {
  return `${PUBLIC_ID_PREFIX}_${randomBytes(PUBLIC_ID_BYTES).toString("base64url")}`;
}

export function isValidLetterPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}
