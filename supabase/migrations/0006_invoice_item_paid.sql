-- Ajout du montant payé par ligne de facture pour le reçu de paiement
alter table "InvoiceItem" add column if not exists paid numeric not null default 0;
