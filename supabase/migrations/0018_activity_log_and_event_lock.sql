-- Migration 0018 — Traçabilité : journal d'activité + verrouillage des événements passés
-- À exécuter dans Supabase Dashboard > SQL Editor
-- Idempotent : peut être rejoué sans erreur.

-- ============================================================
-- 1. Table ActivityLog (le « livre de bord »)
-- ============================================================
create table if not exists "ActivityLog" (
  id uuid primary key default gen_random_uuid(),
  entity text not null,                         -- 'Event' | 'Project' | 'Task'
  "entityId" uuid,                              -- id de la ligne concernée
  action text not null check (action in ('created','updated','deleted')),
  "entityLabel" text,                           -- titre/nom au moment de l'action (snapshot)
  "userId" uuid references "User"(id) on delete set null,  -- auteur (null = système)
  "createdAt" timestamptz not null default now()
);

create index if not exists "ActivityLog_createdAt_idx" on "ActivityLog" ("createdAt" desc);
create index if not exists "ActivityLog_entity_idx" on "ActivityLog" (entity);

-- ============================================================
-- 2. Fonction trigger de journalisation (security definer)
--    Récupère l'auteur via auth.uid() et le libellé via title ou name.
-- ============================================================
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  act text;
begin
  if (TG_OP = 'DELETE') then
    rec := to_jsonb(OLD);
    act := 'deleted';
  elsif (TG_OP = 'UPDATE') then
    rec := to_jsonb(NEW);
    act := 'updated';
  else
    rec := to_jsonb(NEW);
    act := 'created';
  end if;

  insert into "ActivityLog" (entity, "entityId", action, "entityLabel", "userId")
  values (
    TG_TABLE_NAME,
    (rec->>'id')::uuid,
    act,
    coalesce(rec->>'title', rec->>'name'),
    auth.uid()
  );

  if (TG_OP = 'DELETE') then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Branchement sur les 3 tables suivies (idempotent)
drop trigger if exists log_activity_event on "Event";
create trigger log_activity_event
  after insert or update or delete on "Event"
  for each row execute procedure public.log_activity();

drop trigger if exists log_activity_project on "Project";
create trigger log_activity_project
  after insert or update or delete on "Project"
  for each row execute procedure public.log_activity();

drop trigger if exists log_activity_task on "Task";
create trigger log_activity_task
  after insert or update or delete on "Task"
  for each row execute procedure public.log_activity();

-- ============================================================
-- 3. RLS sur ActivityLog — lecture admin uniquement, aucune écriture cliente.
--    Seul le trigger (security definer) insère → historique infalsifiable.
-- ============================================================
alter table "ActivityLog" enable row level security;

drop policy if exists "activity_select_admin" on "ActivityLog";
create policy "activity_select_admin" on "ActivityLog" for select
  using (public.is_admin());

-- ============================================================
-- 4. Verrouillage des événements passés (RLS Event)
--    Un non-admin ne peut plus modifier/supprimer un événement dont la fin
--    est dépassée (coalesce(endDate, date) < now()). L'admin, toujours.
--    La création reste autorisée.
-- ============================================================
drop policy if exists "event_write" on "Event";
drop policy if exists "event_insert" on "Event";
drop policy if exists "event_update" on "Event";
drop policy if exists "event_delete" on "Event";

create policy "event_insert" on "Event" for insert
  with check (public.get_user_role() <> 'viewer');

create policy "event_update" on "Event" for update
  using (
    public.get_user_role() <> 'viewer'
    and (public.is_admin() or coalesce("endDate", date) >= now())
  )
  with check (public.get_user_role() <> 'viewer');

create policy "event_delete" on "Event" for delete
  using (
    public.get_user_role() <> 'viewer'
    and (public.is_admin() or coalesce("endDate", date) >= now())
  );
