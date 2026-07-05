-- Migration 0014 — Documents : accepter tous les types de fichiers
-- Lève toute restriction de type MIME sur le bucket "documents" et fixe
-- une limite de taille généreuse (50 Mo). allowed_mime_types = NULL => tous types.

update storage.buckets
set allowed_mime_types = null,
    file_size_limit    = 52428800  -- 50 Mo
where id = 'documents';
