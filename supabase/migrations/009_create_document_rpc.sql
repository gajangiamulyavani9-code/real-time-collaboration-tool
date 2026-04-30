-- Create documents through a controlled function so clients do not depend on
-- direct INSERT policy behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_document(
  input_id UUID,
  input_title TEXT,
  input_content TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  owner_id UUID,
  share_id VARCHAR,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create documents';
  END IF;

  INSERT INTO public.documents (id, title, content, owner_id)
  VALUES (
    input_id,
    COALESCE(NULLIF(TRIM(input_title), ''), 'Untitled Document'),
    COALESCE(input_content, ''),
    v_user_id
  )
  RETURNING
    documents.id,
    documents.title,
    documents.content,
    documents.owner_id,
    documents.share_id,
    documents.updated_at
  INTO
    id,
    title,
    content,
    owner_id,
    share_id,
    updated_at;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
