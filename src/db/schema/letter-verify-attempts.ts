import { pgTable, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { letters } from "./letters";

export const letterVerifyAttempts = pgTable(
  "letter_verify_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK -> letters.id; cascade-delete removes attempts with the letter. */
    letterId: uuid("letter_id")
      .notNull()
      .references(() => letters.id, { onDelete: "cascade" }),

    /**
     * Timestamp of the attempt. Used for windowed counts:
     *   DELETE rows older than the window, then COUNT remaining rows.
     */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("letter_verify_attempts_letter_id_created_at_idx").on(
      table.letterId,
      table.createdAt
    ),
  ]
);

export type LetterVerifyAttempt = typeof letterVerifyAttempts.$inferSelect;
export type NewLetterVerifyAttempt = typeof letterVerifyAttempts.$inferInsert;
