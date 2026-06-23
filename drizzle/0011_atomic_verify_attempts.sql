-- =============================================================================
-- Migration: atomic verify-attempt limiter (custom, journal-tracked)
--
-- The application calls this function instead of doing prune/count/insert as
-- separate statements. A transaction-scoped advisory lock serializes attempts
-- per letter so concurrent guesses cannot all observe a below-limit count and
-- then insert past the cap.
--
-- Execution is revoked from PUBLIC so browser Supabase RPC roles cannot use this
-- function as a letter-level denial-of-service primitive. The server-side DB
-- role that owns the migration/function can still execute it.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_letter_verify_attempt(
  p_letter_id uuid,
  p_actor_key text,
  p_window_seconds integer,
  p_letter_limit integer,
  p_actor_limit integer
)
RETURNS TABLE(allowed boolean, scope text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_letter_count integer;
  v_actor_count integer;
BEGIN
  IF p_letter_id IS NULL THEN
    RAISE EXCEPTION 'letter id is required';
  END IF;

  IF p_actor_key IS NULL OR btrim(p_actor_key) = '' THEN
    RAISE EXCEPTION 'actor key is required';
  END IF;

  IF p_window_seconds <= 0 OR p_letter_limit <= 0 OR p_actor_limit <= 0 THEN
    RAISE EXCEPTION 'rate-limit parameters must be positive';
  END IF;

  v_window_start := now() - make_interval(secs => p_window_seconds);

  -- Serialize all verify attempts for the same letter within this transaction.
  PERFORM pg_advisory_xact_lock(
    hashtext('letter_verify_attempts'),
    hashtext(p_letter_id::text)
  );

  DELETE FROM public.letter_verify_attempts
  WHERE letter_id = p_letter_id
    AND created_at < v_window_start;

  SELECT count(*)::integer
  INTO v_letter_count
  FROM public.letter_verify_attempts
  WHERE letter_id = p_letter_id;

  IF v_letter_count >= p_letter_limit THEN
    RETURN QUERY SELECT false, 'letter'::text;
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO v_actor_count
  FROM public.letter_verify_attempts
  WHERE letter_id = p_letter_id
    AND actor_key = p_actor_key;

  IF v_actor_count >= p_actor_limit THEN
    RETURN QUERY SELECT false, 'actor'::text;
    RETURN;
  END IF;

  INSERT INTO public.letter_verify_attempts (letter_id, actor_key)
  VALUES (p_letter_id, p_actor_key);

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.record_letter_verify_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) FROM PUBLIC;

COMMENT ON FUNCTION public.record_letter_verify_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) IS 'Atomically prunes, checks, and records shared-secret verify attempts under a per-letter advisory lock.';
