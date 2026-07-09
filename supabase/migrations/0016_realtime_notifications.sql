-- Migration 0016 — Notifications en temps réel
-- ============================================================
-- Le front-end (Topbar.jsx) s'abonne déjà aux INSERT sur la table
-- "Notification" via supabase.channel(...).on('postgres_changes', ...).
-- Mais pour que Postgres émette ces événements, la table doit faire
-- partie de la publication `supabase_realtime`. Sans ça, aucune
-- notification n'arrive tant que la page n'est pas réactualisée.
-- ============================================================

-- 1. S'assurer que la publication Realtime existe (créée par défaut sur Supabase)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2. REPLICA IDENTITY FULL : permet à Realtime de transmettre l'ancienne
--    valeur des lignes lors des UPDATE/DELETE (utile si on écoute plus tard
--    les changements de statut « lu »). Sans effet sur les INSERT.
alter table "Notification" replica identity full;

-- 3. Ajouter la table à la publication (idempotent : ne rejoue pas si déjà présente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'Notification'
  ) then
    alter publication supabase_realtime add table "Notification";
  end if;
end $$;
