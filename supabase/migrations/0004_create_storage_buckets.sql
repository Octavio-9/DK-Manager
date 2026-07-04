-- ============================================================
-- Création des buckets de stockage Supabase
-- IMPORTANT: Exécuter UNIQUEMENT cette section dans le SQL Editor.
-- Les politiques (RLS) doivent être configurées via le Dashboard
-- Supabase : Storage > [bucket] > Policies
-- ============================================================

insert into storage.buckets (id, name, public)
values 
  ('documents', 'documents', true),
  ('productions', 'productions', true)
on conflict (id) do nothing;

-- ============================================================
-- Politiques à créer manuellement dans le Dashboard Supabase :
-- Storage > documents > Policies > New Policy
--
-- Bucket 'documents' :
--   - SELECT  : rôle public      | condition : true
--   - INSERT  : rôle authenticated | condition : true
--   - UPDATE  : rôle authenticated | condition : true
--   - DELETE  : rôle authenticated | condition : true
--
-- Bucket 'productions' :
--   - SELECT  : rôle public      | condition : true
--   - INSERT  : rôle authenticated | condition : true
--   - UPDATE  : rôle authenticated | condition : true
--   - DELETE  : rôle authenticated | condition : true
-- ============================================================
