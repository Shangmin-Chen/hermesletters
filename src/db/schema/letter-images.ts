import { pgTable, uuid, text, integer, index } from "drizzle-orm/pg-core";
import { letters } from "./letters";

export const letterImages = pgTable(
  "letter_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK → letters.id; cascade-delete removes images when the letter is deleted. */
    letterId: uuid("letter_id")
      .notNull()
      .references(() => letters.id, { onDelete: "cascade" }),

    /**
     * Path in the private "letters" Supabase Storage bucket.
     * Signed URLs are minted server-side by the service role; clients never
     * read this table directly.
     */
    storagePath: text("storage_path").notNull(),

    /** Display order within the letter's image gallery (0-based). */
    position: integer("position").notNull().default(0),
  },
  (table) => [
    /** Supports efficient retrieval of all images for a given letter. */
    index("letter_images_letter_id_idx").on(table.letterId),
  ]
);

export type LetterImage = typeof letterImages.$inferSelect;
export type NewLetterImage = typeof letterImages.$inferInsert;
