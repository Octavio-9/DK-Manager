-- Migration 0023 — Dernière connexion des utilisateurs (« Vu il y a X »)
-- ============================================================
-- Ajoute "User"."lastSeenAt" et une fonction sécurisée touch_last_seen()
-- que le client appelle périodiquement (heartbeat) pour horodater sa
-- dernière activité. La fonction ne met à jour QUE la ligne de
-- l'utilisateur courant (auth.uid()) — le client ne peut donc rien
-- écrire d'autre dans la table "User".
-- ============================================================

alter table "User" add column if not exists "lastSeenAt" timestamptz;

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update "User" set "lastSeenAt" = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;
