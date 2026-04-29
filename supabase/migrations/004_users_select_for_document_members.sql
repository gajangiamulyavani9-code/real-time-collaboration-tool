-- Allow authenticated users to read basic user rows for people
-- in documents they share, while still protecting unrelated users.

BEGIN;

DROP POLICY IF EXISTS "Users can read their own data" ON public.users;

CREATE POLICY "Users can read self or shared-document users"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    LEFT JOIN public.document_collaborators c_target
      ON c_target.document_id = d.id
      AND c_target.user_id = users.id
    WHERE
      (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.document_collaborators c_me
          WHERE c_me.document_id = d.id
            AND c_me.user_id = auth.uid()
        )
      )
      AND (
        d.owner_id = users.id
        OR c_target.user_id IS NOT NULL
      )
  )
);

COMMIT;
