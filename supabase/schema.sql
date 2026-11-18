-- Run as the trusted database owner. Never run with an untrusted function owner.
-- Existing rows, constraints, policies, and unrelated service-only RPCs are retained.
BEGIN;

CREATE TABLE IF NOT EXISTS public.characters (
  session_id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  sex text NOT NULL CHECK (sex IN ('female', 'male', 'other', 'prefer_not_to_say')),
  age integer NOT NULL CHECK (age BETWEEN 18 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.answers (
  session_id uuid NOT NULL REFERENCES public.characters(session_id),
  story_version text NOT NULL,
  question_id text NOT NULL,
  option_id text NOT NULL,
  option_text text NOT NULL,
  correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.submissions (
  session_id uuid NOT NULL REFERENCES public.characters(session_id),
  story_version text NOT NULL,
  question_id text NOT NULL,
  selection_hash text NOT NULL,
  PRIMARY KEY (session_id, story_version, question_id)
);
CREATE TABLE IF NOT EXISTS public.game_session_keys (
  session_id uuid PRIMARY KEY REFERENCES public.characters(session_id),
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
CREATE TABLE IF NOT EXISTS public.game_stories (
  version text PRIMARY KEY CHECK (char_length(version) > 0),
  nodes jsonb NOT NULL CHECK (jsonb_typeof(nodes) = 'array')
);

-- Nullable for legacy games and links without an email parameter.
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS characters_email_idx ON public.characters(email);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.characters, public.answers, public.submissions,
  public.game_session_keys, public.game_stories FROM PUBLIC, anon, authenticated;

-- Avoid ambiguous RPC overloads; the default keeps older clients compatible.
DROP FUNCTION IF EXISTS public.save_game_character(uuid, uuid, text, integer, text);
CREATE OR REPLACE FUNCTION public.save_game_character(
  p_session_id uuid, p_token uuid, p_name text, p_age integer, p_sex text, p_email text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_character public.characters%ROWTYPE;
  v_hash text;
  v_stored_hash text;
BEGIN
  IF p_session_id IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Invalid session credentials' USING ERRCODE = '22023';
  END IF;
  -- Shared by both RPCs; also protects the absent-row/new-session case.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text, 0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token::text, 'UTF8')), 'hex');
  SELECT token_hash INTO v_stored_hash FROM public.game_session_keys WHERE session_id = p_session_id;
  SELECT * INTO v_character FROM public.characters WHERE session_id = p_session_id;
  IF (v_character.session_id IS NOT NULL OR v_stored_hash IS NOT NULL)
      AND v_stored_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'Invalid session credentials' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_name)) NOT BETWEEN 1 AND 60
      OR p_name ~ '[[:cntrl:]]' OR p_age IS NULL OR p_age NOT BETWEEN 18 AND 120
      OR p_sex IS NULL OR p_sex NOT IN ('female', 'male', 'other', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Invalid adult character' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NOT NULL AND (pg_catalog.char_length(p_email) > 254
      OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;
  IF v_character.session_id IS NOT NULL THEN
    IF v_character.name IS DISTINCT FROM pg_catalog.btrim(p_name)
        OR v_character.age IS DISTINCT FROM p_age OR v_character.sex IS DISTINCT FROM p_sex
        OR v_character.email IS DISTINCT FROM p_email THEN
      RAISE EXCEPTION 'Character is immutable' USING ERRCODE = '22023';
    END IF;
    RETURN pg_catalog.jsonb_build_object('status', 'saved');
  END IF;
  INSERT INTO public.characters(session_id, name, age, sex, email)
    VALUES (p_session_id, pg_catalog.btrim(p_name), p_age, p_sex, p_email);
  INSERT INTO public.game_session_keys(session_id, token_hash) VALUES (p_session_id, v_hash);
  RETURN pg_catalog.jsonb_build_object('status', 'saved');
END;
$$;
REVOKE ALL ON FUNCTION public.save_game_character(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_game_character(uuid, uuid, text, integer, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_game_answer(
  p_session_id uuid, p_token uuid, p_story_version text, p_question_id text, p_option_ids text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_stored_hash text;
  v_nodes jsonb;
  v_question jsonb;
  v_selection_hash text;
  v_prior_hash text;
  v_count integer;
  v_distinct integer;
  v_recorded integer;
BEGIN
  IF p_session_id IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Invalid session credentials' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text, 0));
  SELECT token_hash INTO v_stored_hash FROM public.game_session_keys WHERE session_id = p_session_id;
  IF v_stored_hash IS NULL OR v_stored_hash IS DISTINCT FROM
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token::text, 'UTF8')), 'hex')
      OR NOT EXISTS (SELECT 1 FROM public.characters WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'Invalid session credentials' USING ERRCODE = '42501';
  END IF;
  -- Authentication precedes every question/version/previous-selection lookup.
  SELECT nodes INTO v_nodes FROM public.game_stories WHERE version = p_story_version FOR SHARE;
  IF v_nodes IS NULL THEN
    RAISE EXCEPTION 'Unknown story version' USING ERRCODE = '22023';
  END IF;
  SELECT node INTO v_question FROM pg_catalog.jsonb_array_elements(v_nodes) AS n(node)
    WHERE node->>'type' = 'question' AND node->>'id' = p_question_id;
  IF v_question IS NULL THEN
    RAISE EXCEPTION 'Invalid question' USING ERRCODE = '22023';
  END IF;
  SELECT pg_catalog.count(*)::integer, pg_catalog.count(DISTINCT id)::integer
    INTO v_count, v_distinct FROM pg_catalog.unnest(p_option_ids) AS selected(id);
  IF p_option_ids IS NULL OR pg_catalog.array_ndims(p_option_ids) IS DISTINCT FROM 1
      OR v_count <> v_distinct OR v_count < (v_question->>'min')::integer
      OR v_count > (v_question->>'max')::integer
      OR (v_question->>'mode' = 'single' AND v_count <> 1)
      OR EXISTS (
        SELECT 1 FROM pg_catalog.unnest(p_option_ids) AS selected(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements(v_question->'options') AS o(option)
          WHERE option->>'id' = selected.id
        )
      ) THEN
    RAISE EXCEPTION 'Invalid answer selection' USING ERRCODE = '22023';
  END IF;
  -- Sort using a fixed collation; JSON encoding avoids delimiter ambiguity.
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.jsonb_agg(id ORDER BY id COLLATE pg_catalog."C")::text, 'UTF8')), 'hex')
    INTO v_selection_hash FROM pg_catalog.unnest(p_option_ids) AS selected(id);
  SELECT selection_hash INTO v_prior_hash FROM public.submissions
    WHERE session_id = p_session_id AND story_version = p_story_version AND question_id = p_question_id;
  IF FOUND THEN
    IF v_prior_hash IS DISTINCT FROM v_selection_hash THEN
      RAISE EXCEPTION 'Conflicting answer submission' USING ERRCODE = '22023';
    END IF;
    SELECT pg_catalog.count(*)::integer INTO v_recorded FROM public.answers
      WHERE session_id = p_session_id AND story_version = p_story_version AND question_id = p_question_id;
  ELSE
    INSERT INTO public.submissions(session_id, story_version, question_id, selection_hash)
      VALUES (p_session_id, p_story_version, p_question_id, v_selection_hash);
    INSERT INTO public.answers(session_id, story_version, question_id, option_id, option_text, correct)
      SELECT p_session_id, p_story_version, p_question_id, option->>'id', option->>'text', (option->>'correct')::boolean
      FROM pg_catalog.jsonb_array_elements(v_question->'options') AS o(option)
      WHERE option->>'id' = ANY(p_option_ids) AND option->'save' = 'true'::jsonb;
    GET DIAGNOSTICS v_recorded = ROW_COUNT;
  END IF;
  RETURN pg_catalog.jsonb_build_object('status', CASE WHEN v_recorded > 0 THEN 'saved' ELSE 'not-recorded' END,
    'recorded', v_recorded);
END;
$$;
REVOKE ALL ON FUNCTION public.save_game_answer(uuid, uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_game_answer(uuid, uuid, text, text, text[]) TO anon, authenticated;

COMMIT;
