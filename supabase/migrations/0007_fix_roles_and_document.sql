-- Migration 0007 — Correction des rôles utilisateurs et du schéma Document
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ============================================================
-- 1. S'assurer que les rôles de base existent
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
-- 2. Attribuer un rôle à tous les utilisateurs sans roleId
--    (sinon get_user_role() retourne null → toutes les écritures bloquées)
-- ============================================================

update "User"
set "roleId" = (select id from "Role" where name = 'Administrateur' limit 1)
where "roleId" is null;

-- ============================================================
-- 3. Aligner le schéma de la table Document avec le frontend
-- ============================================================

-- Renommer 'name' en 'title' (si la colonne 'title' n'existe pas encore)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'Document' and column_name = 'title'
  ) then
    alter table "Document" rename column name to title;
  end if;
end $$;

-- Renommer 'fileUrl' en 'url' (si 'url' n'existe pas encore)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'Document' and column_name = 'url'
  ) then
    alter table "Document" rename column "fileUrl" to url;
  end if;
end $$;

-- Rendre url nullable (parfois c'est un lien externe, parfois un fichier uploadé)
alter table "Document" alter column url drop not null;

-- Ajouter la colonne tags si elle n'existe pas
alter table "Document" add column if not exists tags text[] not null default '{}';

-- Ajouter la colonne notes si elle n'existe pas
alter table "Document" add column if not exists notes text;

-- Supprimer l'ancienne contrainte check sur le type et en créer une nouvelle
alter table "Document" drop constraint if exists "Document_type_check";
alter table "Document"
  add constraint "Document_type_check"
  check (type in ('Contrat', 'Devis', 'Bon de commande', 'Rapport', 'Facture', 'Autre'));

-- ============================================================
-- 4. Vérification finale (affiche l'état après migration)
-- ============================================================

select id, email, role, "roleId",
       (select name from "Role" where id = "User"."roleId") as "roleName"
from "User";
