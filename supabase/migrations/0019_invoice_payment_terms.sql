-- Migration 0019 — Conditions de paiement éditables sur les factures
-- ============================================================
-- Ajoute une colonne libre "paymentTerms" à "Invoice" pour que le texte
-- des conditions de paiement (ex. « Paiement sous 15 jours », « sous 30 jours »…)
-- soit modifiable par document au lieu d'être codé en dur dans le rendu.
-- Colonne optionnelle : les documents existants affichent la valeur par
-- défaut « Paiement sous 15 jours » (repli côté rendu).
-- ============================================================

alter table "Invoice" add column if not exists "paymentTerms" text;
