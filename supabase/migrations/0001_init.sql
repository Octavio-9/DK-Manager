-- DK Production Manager — schema initial
-- Tables, triggers, RLS

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists "User" (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  role text not null default 'operator' check (role in ('admin','manager','operator','viewer')),
  "avatarBg" text not null default '#9d3bf1',
  "passwordHash" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Client" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'PARTICULIER' check (type in ('PARTICULIER','ENTREPRENEUR','CREATEUR','ENTREPRISE','MARQUE','INSTITUTION','PARTENAIRE')),
  status text not null default 'PROSPECT' check (status in ('PROSPECT','EN_DISCUSSION','ACTIF','FIDELE','INACTIF')),
  email text,
  phone text,
  address text,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ProjectType" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#9d3bf1'
);

create table if not exists "Project" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'PLANNING' check (status in ('PLANNING','FILMING','EDITING','DELIVERED')),
  "clientId" uuid references "Client"(id) on delete set null,
  "typeId" uuid references "ProjectType"(id) on delete set null,
  budget numeric not null default 0,
  "amountPaid" numeric not null default 0,
  deadline date,
  "startDate" date,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Task" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','REVIEW','DONE')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  "projectId" uuid references "Project"(id) on delete set null,
  "assigneeId" uuid references "User"(id) on delete set null,
  "dueDate" date,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "EventType" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#22d3ee'
);

create table if not exists "Event" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date timestamptz not null,
  "endDate" timestamptz,
  "projectId" uuid references "Project"(id) on delete set null,
  "typeId" uuid references "EventType"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Notification" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references "User"(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  "createdAt" timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on "User"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Client"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Project"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Task"
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on "Event"
  for each row execute procedure public.set_updated_at();

-- Auto-create a User profile row when a new auth user signs up
-- (covers email/password signup and Google OAuth)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."User" (id, name, email, role, "avatarBg")
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'operator',
    '#9d3bf1'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- HELPERS
-- ============================================================

create or replace function public.get_user_role()
returns text as $$
  select role from "User" where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select coalesce((select role from "User" where id = auth.uid()) = 'admin', false);
$$ language sql security definer stable set search_path = public;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table "User" enable row level security;
alter table "Client" enable row level security;
alter table "ProjectType" enable row level security;
alter table "Project" enable row level security;
alter table "Task" enable row level security;
alter table "EventType" enable row level security;
alter table "Event" enable row level security;
alter table "Notification" enable row level security;

-- User: everyone authenticated can read profiles (needed for team/assignee display),
-- but only the owner or an admin can modify a row, and only admins manage accounts.
create policy "user_select_all" on "User" for select
  using (auth.role() = 'authenticated');
create policy "user_update_own_or_admin" on "User" for update
  using (auth.uid() = id or public.is_admin());
create policy "user_insert_admin" on "User" for insert
  with check (public.is_admin());
create policy "user_delete_admin" on "User" for delete
  using (public.is_admin());

-- Reference tables: readable by all authenticated, manageable by non-viewers
create policy "project_type_select" on "ProjectType" for select
  using (auth.role() = 'authenticated');
create policy "project_type_write" on "ProjectType" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

create policy "event_type_select" on "EventType" for select
  using (auth.role() = 'authenticated');
create policy "event_type_write" on "EventType" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

-- Business tables: readable by all authenticated, manageable by non-viewers
create policy "client_select" on "Client" for select
  using (auth.role() = 'authenticated');
create policy "client_write" on "Client" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

create policy "project_select" on "Project" for select
  using (auth.role() = 'authenticated');
create policy "project_write" on "Project" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

create policy "task_select" on "Task" for select
  using (auth.role() = 'authenticated');
create policy "task_write" on "Task" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

create policy "event_select" on "Event" for select
  using (auth.role() = 'authenticated');
create policy "event_write" on "Event" for all
  using (public.get_user_role() <> 'viewer')
  with check (public.get_user_role() <> 'viewer');

-- Notifications: scoped to their owner
create policy "notification_select_own" on "Notification" for select
  using ("userId" = auth.uid());
create policy "notification_update_own" on "Notification" for update
  using ("userId" = auth.uid());
create policy "notification_insert" on "Notification" for insert
  with check (auth.role() = 'authenticated');
create policy "notification_delete_own" on "Notification" for delete
  using ("userId" = auth.uid());
