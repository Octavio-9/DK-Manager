-- Migration 0020 — Abonnements Web Push (notifications hors-app)
-- ============================================================
-- Stocke l'abonnement push de chaque appareil d'un utilisateur.
-- L'Edge Function `send-push` lit cette table (via service_role) pour
-- envoyer les notifications hors-app.
-- ============================================================

create table if not exists "PushSubscription" (
  id          uuid        primary key default gen_random_uuid(),
  "userId"    uuid        not null references "User"(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists push_subscription_user on "PushSubscription" ("userId");

alter table "PushSubscription" enable row level security;

-- Chaque utilisateur ne gère que ses propres abonnements
create policy "push_sub_select_own" on "PushSubscription"
  for select using ("userId" = auth.uid());
create policy "push_sub_insert_own" on "PushSubscription"
  for insert with check ("userId" = auth.uid());
create policy "push_sub_update_own" on "PushSubscription"
  for update using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy "push_sub_delete_own" on "PushSubscription"
  for delete using ("userId" = auth.uid());
