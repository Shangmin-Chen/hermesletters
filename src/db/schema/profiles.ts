import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The FK constraint  profiles.id → auth.users(id) ON DELETE CASCADE
 * is NOT declared inline here because Drizzle would attempt to CREATE the
 * auth.users table (which is owned by Supabase and already exists).
 *
 * Instead the FK is added via a hand-written migration:
 *   drizzle/0001_rls_storage.sql
 * which runs after the Drizzle-generated migration.
 */
export const profiles = pgTable("profiles", {
  /** Equals the Supabase auth.users.id for this user. */
  id: uuid("id").primaryKey(),
  /** Stable URL-safe handle chosen at onboarding; used as the first path segment. */
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
