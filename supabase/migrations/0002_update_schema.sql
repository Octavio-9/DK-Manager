-- DK Production Manager — Migration de Schéma 0002
-- Ajout des tables et champs pour Factures, Documents, Productions, Transactions et Rôles Créatifs

-- ============================================================
-- 1. ROLES ET UTILISATEURS
-- ============================================================

-- Table Role
create table if not exists "Role" (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Insertion des nouveaux rôles du cahier des charges
insert into "Role" (name) values
  ('Administrateur'),
  ('Manager'),
  ('Monteur vidéo'),
  ('Photographe'),
  ('Community manager'),
  ('Commercial')
on conflict (name) do nothing;

-- Ajout du champ roleId à la table User
alter table "User" add column if not exists "roleId" uuid references "Role"(id) on delete set null;

-- Migration des utilisateurs existants vers les nouveaux rôles
update "User" u
set "roleId" = (select id from "Role" where name = 'Administrateur')
where u.role = 'admin' and u."roleId" is null;

update "User" u
set "roleId" = (select id from "Role" where name = 'Manager')
where u.role = 'manager' and u."roleId" is null;

update "User" u
set "roleId" = (select id from "Role" where name = 'Monteur vidéo')
where u.role in ('operator', 'viewer') and u."roleId" is null;

-- Valeur par défaut pour les nouveaux utilisateurs
update "User"
set "roleId" = (select id from "Role" where name = 'Monteur vidéo')
where "roleId" is null;

-- Suppression de l'ancienne contrainte check sur le rôle string
alter table "User" drop constraint if exists "User_role_check";

-- Ajout des nouveaux champs profil utilisateur
alter table "User" add column if not exists "firstName" text;
alter table "User" add column if not exists "lastName" text;
alter table "User" add column if not exists "phone" text;
alter table "User" add column if not exists "status" text default 'active' check (status in ('active', 'inactive'));
alter table "User" add column if not exists "avatarUrl" text;

-- Trigger pour synchroniser le rôle hérité/Edge Function avec roleId
create or replace function public.sync_user_role_id()
returns trigger as $$
declare
  target_role_name text;
  target_role_id uuid;
begin
  if new.role is not null and (old.role is null or old.role <> new.role) then
    if new.role = 'admin' then
      target_role_name := 'Administrateur';
    elsif new.role = 'manager' then
      target_role_name := 'Manager';
    elsif new.role = 'operator' then
      target_role_name := 'Monteur vidéo';
    elsif new.role = 'viewer' then
      target_role_name := 'Monteur vidéo';
    else
      target_role_name := new.role;
    end if;
    
    select id into target_role_id from public."Role" where name = target_role_name;
    if target_role_id is not null then
      new."roleId" := target_role_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists sync_user_role_id on public."User";
create trigger sync_user_role_id before insert or update on public."User"
  for each row execute procedure public.sync_user_role_id();

-- Mettre à jour handle_new_user pour lier par défaut
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public."Role" where name = 'Monteur vidéo';
  
  insert into public."User" (id, name, email, role, "avatarBg", "roleId")
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'operator',
    '#9d3bf1',
    default_role_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 2. CLIENTS (CRM)
-- ============================================================

alter table "Client" add column if not exists "companyName" text;
alter table "Client" add column if not exists "contactName" text;
alter table "Client" add column if not exists "industry" text;

-- Table ClientContact (Plusieurs contacts par client)
create table if not exists "ClientContact" (
  id uuid primary key default gen_random_uuid(),
  "clientId" uuid not null references "Client"(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  position text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- ============================================================
-- 3. PROJETS & TACHES
-- ============================================================

alter table "Project" add column if not exists "createdBy" uuid references "User"(id) on delete set null;

-- Modification des statuts de tâche pour inclure 'BLOCKED'
alter table "Task" drop constraint if exists "Task_status_check";
alter table "Task" add constraint "Task_status_check" check (status in ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'));

-- ============================================================
-- 4. EVENEMENTS
-- ============================================================

alter table "Event" add column if not exists "location" text;
alter table "Event" add column if not exists "createdBy" uuid references "User"(id) on delete set null;

-- ============================================================
-- 5. PRODUCTION MEDIA
-- ============================================================

create table if not exists "Production" (
  id uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references "Project"(id) on delete cascade,
  type text not null check (type in ('Podcast', 'Photo', 'Vidéo', 'Shooting')),
  title text not null,
  "recordingDate" date,
  location text,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'RECORDED', 'EDITING', 'READY')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ProductionFile" (
  id uuid primary key default gen_random_uuid(),
  "productionId" uuid not null references "Production"(id) on delete cascade,
  "fileName" text not null,
  "fileUrl" text not null,
  type text not null, -- 'rush', 'photo', 'final', etc.
  "uploadedBy" uuid references "User"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

-- ============================================================
-- 6. FACTURATION
-- ============================================================

create table if not exists "Invoice" (
  id uuid primary key default gen_random_uuid(),
  "clientId" uuid references "Client"(id) on delete set null,
  "invoiceNumber" text not null unique,
  total numeric not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  "dueDate" date,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "InvoiceItem" (
  id uuid primary key default gen_random_uuid(),
  "invoiceId" uuid not null references "Invoice"(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  price numeric not null default 0
);

-- ============================================================
-- 7. DOCUMENTS
-- ============================================================

create table if not exists "Document" (
  id uuid primary key default gen_random_uuid(),
  "clientId" uuid references "Client"(id) on delete set null,
  "projectId" uuid references "Project"(id) on delete set null,
  name text not null,
  "fileUrl" text not null,
  type text not null check (type in ('CONTRAT', 'DEVIS', 'BRIEF', 'LIVRABLE')),
  "uploadedBy" uuid references "User"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- ============================================================
-- 8. COMPTABILITE / FINANCE
-- ============================================================

create table if not exists "FinanceCategory" (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('INCOME', 'EXPENSE'))
);

insert into "FinanceCategory" (name, type) values
  ('Podcast', 'INCOME'),
  ('Shooting', 'INCOME'),
  ('Gestion réseaux sociaux', 'INCOME'),
  ('Transport', 'EXPENSE'),
  ('Matériel', 'EXPENSE'),
  ('Publicité', 'EXPENSE'),
  ('Salaires', 'EXPENSE')
on conflict (name) do nothing;

create table if not exists "Transaction" (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INCOME', 'EXPENSE')),
  "categoryId" uuid references "FinanceCategory"(id) on delete set null,
  "clientId" uuid references "Client"(id) on delete set null,
  "projectId" uuid references "Project"(id) on delete set null,
  amount numeric not null,
  description text,
  date date not null default current_date,
  "createdBy" uuid references "User"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

-- ============================================================
-- 9. TRIGGERS POUR UPDATED_AT
-- ============================================================

create trigger set_updated_at before update on "ClientContact"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Production"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Invoice"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Document"
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 10. REDEFINITION DES FONCTIONS AIDE RLS (ROLES)
-- ============================================================

create or replace function public.get_user_role()
returns text as $$
  select r.name
  from "User" u
  join "Role" r on u."roleId" = r.id
  where u.id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select r.name
     from "User" u
     join "Role" r on u."roleId" = r.id
     where u.id = auth.uid()) = 'Administrateur',
    false
  );
$$ language sql security definer stable set search_path = public;

-- ============================================================
-- 11. SECURITE RLS POUR LES NOUVELLES TABLES
-- ============================================================

alter table "Role" enable row level security;
alter table "ClientContact" enable row level security;
alter table "Production" enable row level security;
alter table "ProductionFile" enable row level security;
alter table "Invoice" enable row level security;
alter table "InvoiceItem" enable row level security;
alter table "Document" enable row level security;
alter table "FinanceCategory" enable row level security;
alter table "Transaction" enable row level security;

-- Politiques de lecture : tout utilisateur connecté
create policy "role_select" on "Role" for select using (auth.role() = 'authenticated');
create policy "client_contact_select" on "ClientContact" for select using (auth.role() = 'authenticated');
create policy "production_select" on "Production" for select using (auth.role() = 'authenticated');
create policy "production_file_select" on "ProductionFile" for select using (auth.role() = 'authenticated');
create policy "invoice_select" on "Invoice" for select using (auth.role() = 'authenticated');
create policy "invoice_item_select" on "InvoiceItem" for select using (auth.role() = 'authenticated');
create policy "document_select" on "Document" for select using (auth.role() = 'authenticated');
create policy "finance_category_select" on "FinanceCategory" for select using (auth.role() = 'authenticated');
create policy "transaction_select" on "Transaction" for select using (auth.role() = 'authenticated');

-- Politiques d'écriture : uniquement les utilisateurs qui ne sont pas de simples "viewers"
-- Pour la table Role : réservé aux administrateurs
create policy "role_admin_write" on "Role" for all using (public.is_admin());

create policy "client_contact_write" on "ClientContact" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "production_write" on "Production" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "production_file_write" on "ProductionFile" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "invoice_write" on "Invoice" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "invoice_item_write" on "InvoiceItem" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "document_write" on "Document" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "finance_category_write" on "FinanceCategory" for all
  using (public.is_admin() or public.get_user_role() = 'Manager')
  with check (public.is_admin() or public.get_user_role() = 'Manager');

create policy "transaction_write" on "Transaction" for all
  using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);
