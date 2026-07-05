-- Restrict Document UPDATE and DELETE to the document owner (uploadedBy)
-- Replaces the all-encompassing "document_write" policy with 3 granular ones

DROP POLICY IF EXISTS "document_write" ON "Document";

-- INSERT: any authenticated user with a role can add a document
CREATE POLICY "document_insert" ON "Document"
  FOR INSERT
  WITH CHECK (public.get_user_role() IS NOT NULL);

-- UPDATE: only the uploader can edit (NULL uploadedBy = legacy, editable by all)
CREATE POLICY "document_update" ON "Document"
  FOR UPDATE
  USING (auth.uid() = "uploadedBy" OR "uploadedBy" IS NULL)
  WITH CHECK (auth.uid() = "uploadedBy" OR "uploadedBy" IS NULL);

-- DELETE: only the uploader can delete (NULL uploadedBy = legacy, deletable by all)
CREATE POLICY "document_delete" ON "Document"
  FOR DELETE
  USING (auth.uid() = "uploadedBy" OR "uploadedBy" IS NULL);
