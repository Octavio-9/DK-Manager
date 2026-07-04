-- DK Production Manager — Migration 0003
-- Fonctionnalités avancées : Calendrier Éditorial, Validation Client

-- ============================================================
-- 1. CALENDRIER ÉDITORIAL RÉSEAUX SOCIAUX
-- ============================================================

create table if not exists "SocialPost" (
  id uuid primary key default gen_random_uuid(),
  "projectId"  uuid references "Project"(id) on delete set null,
  "clientId"   uuid references "Client"(id) on delete set null,
  platform     text not null check (platform in ('Instagram','LinkedIn','TikTok','YouTube','Facebook','Twitter')),
  content      text,
  "mediaUrl"   text,
  "scheduledAt" timestamptz,
  status       text not null default 'DRAFT'
                check (status in ('DRAFT','SCHEDULED','PUBLISHED','CANCELLED')),
  notes        text,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

alter table "SocialPost" enable row level security;

create policy "Authenticated users can manage social posts"
  on "SocialPost" for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- 2. VALIDATION CLIENT POUR LES PRODUCTIONS
-- ============================================================

-- Ajouter token de validation et statut aux Productions
alter table "Production"
  add column if not exists "validationToken"  text unique,
  add column if not exists "validationStatus" text not null default 'PENDING'
    check ("validationStatus" in ('PENDING','APPROVED','CHANGES_REQUESTED')),
  add column if not exists "clientComment"    text,
  add column if not exists "validatedAt"      timestamptz;

-- ============================================================
-- 3. INDEX UTILES
-- ============================================================

create index if not exists idx_social_post_project   on "SocialPost"("projectId");
create index if not exists idx_social_post_client    on "SocialPost"("clientId");
create index if not exists idx_social_post_scheduled on "SocialPost"("scheduledAt");
create index if not exists idx_social_post_status    on "SocialPost"(status);

create index if not exists idx_production_token on "Production"("validationToken");

-- ============================================================
-- 4. TRIGGER updatedAt pour SocialPost
-- ============================================================

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists trg_social_post_updated_at on "SocialPost";
create trigger trg_social_post_updated_at
  before update on "SocialPost"
  for each row execute function update_updated_at_column();
