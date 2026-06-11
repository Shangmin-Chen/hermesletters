/**
 * Central schema export.
 * Import from here (not individual files) to keep the public surface stable.
 */

export { profiles } from "./profiles";
export type { Profile, NewProfile } from "./profiles";

export { letterStatusEnum, letters } from "./letters";
export type { Letter, NewLetter } from "./letters";

export { letterImages } from "./letter-images";
export type { LetterImage, NewLetterImage } from "./letter-images";

export { letterVerifyAttempts } from "./letter-verify-attempts";
export type { LetterVerifyAttempt, NewLetterVerifyAttempt } from "./letter-verify-attempts";
