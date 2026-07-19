-- Migration 0021 — Lien facture ↔ transaction (revenu automatique) + catégorie « Facturation »
-- À exécuter dans Supabase Dashboard > SQL Editor. Idempotent.

-- 1. Colonne de lien vers la transaction Revenu générée quand la facture est payée.
--    (permet la mise à jour et la suppression/réversibilité du revenu)
alter table "Invoice"
  add column if not exists "transactionId" uuid references "Transaction"(id) on delete set null;

-- 2. Catégorie de revenu dédiée aux encaissements de factures.
insert into "FinanceCategory" (name, type) values ('Facturation', 'INCOME')
on conflict (name) do nothing;
