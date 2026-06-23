-- =============================================================================
-- Migration: lock down public letters RLS policies (custom, journal-tracked)
--
-- Prior migrations allowed authenticated public clients to:
--   1. INSERT letters when sender_id = auth.uid()
--   2. SELECT saved letters when saved_by = auth.uid()
--   3. SELECT direct inbox letters when receiver_id = auth.uid()
--
-- Letter creation and letter reads are now mediated by server-side Drizzle /
-- service-role code paths. Public clients should not be able to bypass server
-- invariants or fetch full sensitive rows from public.letters directly.
--
-- RLS stays enabled on letters. With these permissive policies removed, direct
-- public-client access to letters defaults to deny for INSERT and SELECT.
--
-- The saved-letter SELECT policy is intentionally removed too: the current
-- Received mail flow reads through the server, and any future client-facing
-- saved-letter surface should use a narrow server route or projection instead
-- of granting full-row SELECT on public.letters.
-- =============================================================================

DROP POLICY IF EXISTS "letters: insert as sender" ON "public"."letters";
DROP POLICY IF EXISTS "letters: select saved by me" ON "public"."letters";
DROP POLICY IF EXISTS "letters: select received by me" ON "public"."letters";
