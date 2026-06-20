ALTER TABLE "letters" ADD COLUMN "receiver_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "connections_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_receiver_id_profiles_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letters_receiver_id_status_idx" ON "letters" USING btree ("receiver_id","status");--> statement-breakpoint
-- RLS (hand-appended; drizzle-kit does not emit policies).
-- Direct letters: a recipient may SELECT letters addressed to them. Mirrors the
-- existing "letters: select saved by me" policy. All real reads go through the
-- service-role Drizzle client; this is defense-in-depth.
DROP POLICY IF EXISTS "letters: select received by me" ON "public"."letters";--> statement-breakpoint
CREATE POLICY "letters: select received by me"
  ON "public"."letters"
  FOR SELECT
  USING (receiver_id = auth.uid());