-- Migration 0017 — Notifications cliquables (type + lien)
-- ============================================================
-- Ajoute deux colonnes à "Notification" :
--   type : catégorie de la notif ('invoice', 'project', 'objective', 'task'…)
--          → utile pour l'affichage / le filtrage / une icône.
--   link : route interne vers l'élément concerné (ex. '/invoices',
--          '/projects/<id>') → un clic sur la notif y amène directement.
-- Colonnes optionnelles : les notifications existantes restent valides.
-- ============================================================

alter table "Notification" add column if not exists "type" text;
alter table "Notification" add column if not exists "link" text;
