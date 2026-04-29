-- Fix ambiguous "document_id" reference inside join RPC.
-- Keeps RPC response shape unchanged: { document_id, role }.

BEGIN;

CREATE OR REPLACE FUNCTION public.join_document_by_share_id(input_share_id TEXT)
RETURNS TABLE(document_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_doc_id UUID;
  v_owner_id UUID;
  v_existing_role TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT d.id, d.owner_id
  INTO v_doc_id, v_owner_id
  FROM public.documents AS d
  WHERE d.share_id = UPPER(TRIM(input_share_id))
  LIMIT 1;

  IF v_doc_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  IF v_owner_id = v_user_id THEN
    RETURN QUERY SELECT v_doc_id AS document_id, 'owner'::TEXT AS role;
    RETURN;
  END IF;

  SELECT c.role
  INTO v_existing_role
  FROM public.document_collaborators AS c
  WHERE c.document_id = v_doc_id
    AND c.user_id = v_user_id
  LIMIT 1;

  IF v_existing_role IS NOT NULL THEN
    IF v_existing_role <> 'editor' THEN
      UPDATE public.document_collaborators AS c
      SET role = 'editor'
      WHERE c.document_id = v_doc_id
        AND c.user_id = v_user_id;
    END IF;

    RETURN QUERY SELECT v_doc_id AS document_id, 'editor'::TEXT AS role;
    RETURN;
  END IF;

  INSERT INTO public.document_collaborators (document_id, user_id, role)
  VALUES (v_doc_id, v_user_id, 'editor')
  ON CONFLICT ON CONSTRAINT document_collaborators_document_id_user_id_key DO NOTHING;

  RETURN QUERY SELECT v_doc_id AS document_id, 'editor'::TEXT AS role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_document_by_share_id(TEXT) TO authenticated;

COMMIT;
