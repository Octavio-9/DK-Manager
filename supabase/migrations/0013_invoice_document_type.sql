-- Migration 0013 — Facturation : distinguer Facture et Reçu
-- Un même module gère les factures (à payer) et les reçus (payés).

-- Type de document : FACTURE (par défaut) ou RECU
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "documentType" text;

-- Les enregistrements existants étaient des reçus de paiement (l'ancien PDF)
UPDATE "Invoice" SET "documentType" = 'RECU' WHERE "documentType" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "documentType" SET DEFAULT 'FACTURE';
ALTER TABLE "Invoice" ALTER COLUMN "documentType" SET NOT NULL;

-- Contrainte de valeurs (sûre à ré-exécuter)
DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT invoice_document_type_check CHECK ("documentType" IN ('FACTURE', 'RECU'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lien optionnel : un reçu peut être généré à partir d'une facture payée
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "sourceInvoiceId" uuid REFERENCES "Invoice"(id) ON DELETE SET NULL;
