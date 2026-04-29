-- Fix RLS recursion between documents and document_collaborators.
-- Run this migration after 001_initial_schema.sql.

BEGIN;

-- Private helper schema for security-definer policy functions
CREATE SCHEMA IF NOT EXISTS private;

-- Returns true when current auth user owns the target document.
CREATE OR REPLACE FUNCTION private.is_document_owner(target_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = target_document_id
      AND d.owner_id = auth.uid()
  );
$$;

-- Returns true when current auth user is owner or collaborator.
CREATE OR REPLACE FUNCTION private.is_document_member(target_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.is_document_owner(target_document_id)
    OR EXISTS (
      SELECT 1
      FROM public.document_collaborators c
      WHERE c.document_id = target_document_id
        AND c.user_id = auth.uid()
    );
$$;

-- Returns true when current auth user can edit (owner or editor).
CREATE OR REPLACE FUNCTION private.can_edit_document(target_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.is_document_owner(target_document_id)
    OR EXISTS (
      SELECT 1
      FROM public.document_collaborators c
      WHERE c.document_id = target_document_id
        AND c.user_id = auth.uid()
        AND c.role = 'editor'
    );
$$;

-- ============================================================
-- Replace recursive policies
-- ============================================================

DROP POLICY IF EXISTS "Owners can manage their documents" ON documents;
DROP POLICY IF EXISTS "Collaborators can view documents" ON documents;
DROP POLICY IF EXISTS "Editors can update document content" ON documents;

DROP POLICY IF EXISTS "Owners can manage collaborators" ON document_collaborators;
DROP POLICY IF EXISTS "Users can see collaborators for their documents" ON document_collaborators;

DROP POLICY IF EXISTS "Document members can view messages" ON messages;
DROP POLICY IF EXISTS "Document members can send messages" ON messages;
DROP POLICY IF EXISTS "Owners can delete any message in their documents" ON messages;

DROP POLICY IF EXISTS "Document members can view versions" ON document_versions;

-- Documents
CREATE POLICY "Documents select for members" ON documents
  FOR SELECT TO authenticated
  USING (private.is_document_member(id));

CREATE POLICY "Documents insert for owners" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Documents update for editors" ON documents
  FOR UPDATE TO authenticated
  USING (private.can_edit_document(id))
  WITH CHECK (private.can_edit_document(id));

CREATE POLICY "Documents delete for owners" ON documents
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Collaborators
CREATE POLICY "Collaborators select for members" ON document_collaborators
  FOR SELECT TO authenticated
  USING (private.is_document_owner(document_id) OR user_id = auth.uid());

CREATE POLICY "Collaborators insert for owners" ON document_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (private.is_document_owner(document_id));

CREATE POLICY "Collaborators update for owners" ON document_collaborators
  FOR UPDATE TO authenticated
  USING (private.is_document_owner(document_id))
  WITH CHECK (private.is_document_owner(document_id));

CREATE POLICY "Collaborators delete for owners_or_self" ON document_collaborators
  FOR DELETE TO authenticated
  USING (private.is_document_owner(document_id) OR user_id = auth.uid());

-- Messages
CREATE POLICY "Messages select for members" ON messages
  FOR SELECT TO authenticated
  USING (private.is_document_member(document_id));

CREATE POLICY "Messages insert for members" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (private.is_document_member(document_id) AND sender_id = auth.uid());

CREATE POLICY "Messages delete own_or_owner" ON messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR private.is_document_owner(document_id));

-- Versions
CREATE POLICY "Versions select for members" ON document_versions
  FOR SELECT TO authenticated
  USING (private.is_document_member(document_id));

COMMIT;
