-- Align public.users with Supabase Auth users and ensure API role grants exist.
-- Run after 001 and 002.

BEGIN;

-- 1) public.users is used by app FKs, but Supabase Auth creates users in auth.users.
-- Make password nullable so auth-created users can be mirrored without local password hashes.
ALTER TABLE public.users
  ALTER COLUMN password DROP NOT NULL;

-- 2) Mirror auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, password, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    NULL,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

-- Backfill any existing auth users not present in public.users
INSERT INTO public.users (id, name, email, password, avatar_url)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User'),
  au.email,
  NULL,
  NULL
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- 3) Ensure authenticated role can use required schemas/tables/functions.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.documents,
  public.document_collaborators,
  public.messages,
  public.document_versions,
  public.users
TO authenticated;

GRANT EXECUTE ON FUNCTION
  private.is_document_owner(UUID),
  private.is_document_member(UUID),
  private.can_edit_document(UUID)
TO authenticated, anon;

COMMIT;
