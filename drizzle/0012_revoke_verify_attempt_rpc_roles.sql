-- =============================================================================
-- Migration: revoke verify-attempt function from Supabase RPC roles
--
-- Supabase can carry explicit EXECUTE grants for `anon` and `authenticated`
-- independently of PUBLIC. The verify-attempt function is an internal server DB
-- primitive, not a browser-callable RPC endpoint, so remove those grants too.
-- =============================================================================

REVOKE ALL ON FUNCTION public.record_letter_verify_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) FROM anon;

REVOKE ALL ON FUNCTION public.record_letter_verify_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) FROM authenticated;
