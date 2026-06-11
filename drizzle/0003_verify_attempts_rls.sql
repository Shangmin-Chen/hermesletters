-- Enable Row Level Security on letter_verify_attempts with no permissive client
-- policy (default-deny). All access is exclusively server-side via Drizzle using
-- the service role, which bypasses RLS. Clients cannot read or write this table
-- directly. This is consistent with the letter_images pattern from 0001_rls_storage.sql.
ALTER TABLE "letter_verify_attempts" ENABLE ROW LEVEL SECURITY;
