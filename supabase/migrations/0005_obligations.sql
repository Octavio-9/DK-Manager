-- Dépenses obligatoires : modèles d'obligations + entrées mensuelles

create table if not exists "ObligationTemplate" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "defaultAmount" numeric not null default 0,
  "categoryId" uuid references "FinanceCategory"(id) on delete set null,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create table if not exists "ObligationEntry" (
  id uuid primary key default gen_random_uuid(),
  "templateId" uuid references "ObligationTemplate"(id) on delete set null,
  month date not null,
  name text not null,
  amount numeric not null,
  "categoryId" uuid references "FinanceCategory"(id) on delete set null,
  done boolean not null default false,
  "paidDate" date,
  "transactionId" uuid references "Transaction"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists obligation_entry_template_month_key
  on "ObligationEntry" ("templateId", month)
  where "templateId" is not null;

alter table "ObligationTemplate" enable row level security;
alter table "ObligationEntry" enable row level security;

create policy "obligation_template_select" on "ObligationTemplate"
  for select using (auth.role() = 'authenticated');
create policy "obligation_template_write" on "ObligationTemplate"
  for all using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "obligation_entry_select" on "ObligationEntry"
  for select using (auth.role() = 'authenticated');
create policy "obligation_entry_write" on "ObligationEntry"
  for all using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);
