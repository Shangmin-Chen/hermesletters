import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

/** Lifecycle states for a letter. */
export const letterStatusEnum = pgEnum("letter_status", [
  "unopened",
  "opened",
  "saved",
  "expired",
]);

export const letters = pgTable(
  "letters",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Stable opaque public lookup key for v2 APIs and canonical public links.
     * Unlike the legacy URL triple, this does not collide when names slugify
     * to the same value.
     */
    publicId: text("public_id").notNull(),

    /** FK → profiles.id; cascade-delete removes letter when sender is deleted. */
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /**
     * Denormalized copy of profiles.handle for legacy URL-path lookups without
     * a join.
     */
    senderHandle: text("sender_handle").notNull(),

    /** Slugified recipient label; also the second legacy URL segment. */
    receiverName: text("receiver_name").notNull(),

    /**
     * FK → profiles.id of the recipient, set ONLY for direct letters sent to an
     * existing phonebook connection. NULL for invite letters (whose recipient is
     * not yet a user). A letter is "direct" iff receiver_id IS NOT NULL: direct
     * letters are opened by receiver identity instead of an invite URL token.
     * Cascade-delete: a deleted recipient removes their recipient-owned direct
     * letters.
     */
    receiverId: uuid("receiver_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),

    /** Slugified letter title; also the third legacy URL segment. */
    letterName: text("letter_name").notNull(),

    /** Full plain-text body of the letter. Never sent to unauthenticated clients. */
    body: text("body").notNull(),

    /**
     * Hash of the invite URL's random open token. Set for invite letters only;
     * direct letters are addressed by receiver_id and do not need a bearer URL
     * token.
     */
    openTokenHash: text("open_token_hash"),

    /**
     * Optional shared-secret prompt shown before a letter opens. Required for
     * invite letters; sender-selectable for direct letters.
     */
    secretPrompt: text("secret_prompt"),

    /**
     * HMAC hash of the normalized shared-secret answer. The answer itself is
     * never stored. Null when a direct letter is sent without a prompt.
     */
    secretAnswerHash: text("secret_answer_hash"),

    /** Per-letter salt used when hashing the shared-secret answer. */
    secretAnswerSalt: text("secret_answer_salt"),

    /**
     * Underline mask derived from the trimmed answer. Spaces are preserved and
     * non-space characters become underscores, so the UI can show answer shape
     * without exposing the answer.
     */
    secretAnswerShape: text("secret_answer_shape"),

    /** Set atomically when the letter is first unsealed. */
    openedAt: timestamp("opened_at", { withTimezone: true }),

    /** Short-lived token issued to the opener's browser cookie on first claim. */
    claimToken: uuid("claim_token"),

    /** Grace-window deadline: openedAt + 24h.  Null until claimed. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * FK → profiles.id of the user who saved the letter.
     * SET NULL if that profile is deleted (letter is retained but un-owned).
     *
     * LIFECYCLE NOTE (Phase 6): deleting a receiver's profile leaves a row with
     * status='saved' AND saved_by=NULL. Phase 6 read logic must treat that
     * orphaned state as inaccessible — do NOT rely on status alone.
     */
    savedBy: uuid("saved_by").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /** Timestamp when the opener saved the letter to their account. */
    savedAt: timestamp("saved_at", { withTimezone: true }),

    /**
     * Set when the keeper archives a saved letter. Null = active (shown in the
     * kept list); non-null = archived (hidden from the kept list but retained
     * and restorable). Archiving is a reversible flag flip — no data is deleted.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    /** Current lifecycle state of the letter. */
    status: letterStatusEnum("status").notNull().default("unopened"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("letters_public_id_unique").on(t.publicId),
    index("letters_saved_by_idx").on(t.savedBy),
    /** Phonebook Leg B + sender-side queries. */
    index("letters_sender_id_idx").on(t.senderId),
    /** Inbox query: a recipient's direct letters by status. */
    index("letters_receiver_id_status_idx").on(t.receiverId, t.status),
    /** Legacy invite URL compatibility lookups after the triple stopped being unique. */
    index("letters_legacy_url_idx").on(
      t.senderHandle,
      t.receiverName,
      t.letterName
    ),
  ]
);

export type Letter = typeof letters.$inferSelect;
export type NewLetter = typeof letters.$inferInsert;
