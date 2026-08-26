-- Migration 0025 — Surcharges de droits par utilisateur (Phase 1, UI)
-- ============================================================
-- Ajoute "User"."permissions" (JSONB) qui stocke, par utilisateur, les
-- ÉCARTS au rôle, par page :
--   { "finance": { "view": false }, "projects": { "delete": false } }
-- Absent / null = comportement 100 % rôle. Appliqué côté interface
-- (masquage pages/boutons) ; l'admin n'est jamais restreint.
-- ============================================================

alter table "User" add column if not exists "permissions" jsonb;
