-- Migration 0008 — Correctif complet
-- Corrige : RLS (get_user_role), schéma Document, bucket Storage
-- Exécuter dans Supabase Dashboard > SQL Editor

-- ============================================================
-- 1. Corriger get_user_role() pour fonctionner même si roleId est null
--    Retombe sur la colonne texte "role" si roleId n'est pas renseigné
-- ============================================================

create or replace function public.get_user_role()
returns text as $$
  select coalesce(
    (select r.name
     from "User" u
     join "Role" r on u."roleId" = r.id
     where u.id = auth.uid()),
    (select u.role
     from "User" u
     where u.id = auth.uid())
  );
$$ language sql security definer stable set search_path = public;

-- ============================================================
-- 2. S'assurer que tous les rôles existent
-- ============================================================

insert into "Role" (name) values
  ('Administrateur'),
  ('Manager'),
  ('Monteur vidéo'),
  ('Photographe'),
  ('Community manager'),
  ('Commercial')
on conflict (name) do nothing;

-- ============================================================
-- 3. Attribuer un roleId à tous les utilisateurs qui n'en ont pas
-- ============================================================

update "User" u
set "roleId" = (
  select r.id from "Role" r
  where r.name = u.role
  limit 1
)
where u."roleId" is null
  and u.role is not null
  and exists (select 1 from "Role" where name = u.role);

-- Si le rôle texte ne correspond à aucun Role, mettre Administrateur
update "User"
set "roleId" = (select id from "Role" where name = 'Administrateur' limit 1)
where "roleId" is null;

-- ============================================================
-- 4. Aligner le schéma de la table Document
-- ============================================================

-- Renommer 'name' → 'title' si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Document' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Document' and column_name = 'title'
  ) then
    alter table "Document" rename column name to title;
  end if;
end $$;

-- Renommer 'fileUrl' → 'url' si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Document' and column_name = 'fileUrl'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Document' and column_name = 'url'
  ) then
    alter table "Document" rename column "fileUrl" to url;
  end if;
end $$;

-- Rendre url nullable
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Document' and column_name = 'url'
  ) then
    alter table "Document" alter column url drop not null;
  end if;
end $$;

-- Ajouter tags et notes si absentes
alter table "Document" add column if not exists tags text[] not null default '{}';
alter table "Document" add column if not exists notes text;

-- Corriger la contrainte CHECK sur le type
alter table "Document" drop constraint if exists "Document_type_check";
alter table "Document"
  add constraint "Document_type_check"
  check (type in ('Contrat', 'Devis', 'Bon de commande', 'Rapport', 'Facture', 'Autre'));

-- ============================================================
-- 5. Bucket Storage "documents" + politiques RLS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

-- Supprimer les anciennes politiques si elles existent
drop policy if exists "documents_select"            on storage.objects;
drop policy if exists "documents_insert"            on storage.objects;
drop policy if exists "documents_update"            on storage.objects;
drop policy if exists "documents_delete"            on storage.objects;
drop policy if exists "Give users access to own folder 1q5jl5_0" on storage.objects;
drop policy if exists "Give users access to own folder 1q5jl5_1" on storage.objects;

-- Lecture publique
create policy "documents_select" on storage.objects
  for select to public
  using (bucket_id = 'documents');

-- Upload pour les utilisateurs connectés
create policy "documents_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents');

-- Mise à jour pour les utilisateurs connectés
create policy "documents_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents');

-- Suppression pour les utilisateurs connectés
create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents');

-- ============================================================
-- 6. Vérification finale
-- ============================================================

select
  u.id,
  u.email,
  u.role        as "roleText",
  r.name        as "roleName",
  u."roleId" is not null as "hasRoleId"
from "User" u
left join "Role" r on r.id = u."roleId";
