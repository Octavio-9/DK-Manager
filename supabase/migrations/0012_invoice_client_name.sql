-- Migration 0012 — Factures : nom de client libre (saisie manuelle)
-- Permet de saisir un client sans l'enregistrer dans la table Client.
-- Quand "clientId" est NULL, on affiche "clientName".

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "clientName" text;
