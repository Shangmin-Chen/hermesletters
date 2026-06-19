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

    /** FK → profiles.id; cascade-delete removes letter when sender is deleted. */
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /**
     * Denormalized copy of profiles.handle for efficient URL-path lookups
     * without a join.
     */
    senderHandle: text("sender_handle").notNull(),

    /** Slugified recipient name (second URL segment). */
    receiverName: text("receiver_name").notNull(),

    /**
     * FK → profiles.id of the recipient, set ONLY for direct letters sent to an
     * existing phonebook connection. NULL for invite letters (whose recipient is
     * not yet a user). A letter is "direct" iff receiver_id IS NOT NULL: direct
     * letters skip claim_token/expires_at/saved_by and live permanently in the
     * recipient's inbox. Cascade-delete: a deleted recipient removes their
     * recipient-owned direct letters.
     */
    receiverId: uuid("receiver_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),

    /** Slugified letter name (third URL segment). */
    letterName: text("letter_name").notNull(),

    /** Full plain-text body of the letter. Never sent to unauthenticated clients. */
    body: text("body").notNull(),

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

    /** Current lifecycle state of the letter. */
    status: letterStatusEnum("status").notNull().default("unopened"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * Named unique constraint on the URL triple so that
     * (senderHandle, receiverName, letterName) resolves to exactly one letter
     * and duplicate creation is rejected at the DB level.
     * The stable constraint name "letters_url_unique" lets Phase 4 server
     * actions catch this specific violation and surface a "that letter name
     * is taken" message without parsing freeform error strings.
     */
    unique("letters_url_unique").on(t.senderHandle, t.receiverName, t.letterName),
    index("letters_saved_by_idx").on(t.savedBy),
    /** Inbox query: a recipient's direct letters by status. */
    index("letters_receiver_id_status_idx").on(t.receiverId, t.status),
  ]
);

export type Letter = typeof letters.$inferSelect;
export type NewLetter = typeof letters.$inferInsert;
