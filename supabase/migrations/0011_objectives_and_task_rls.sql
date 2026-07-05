-- Migration 0011 — Objectifs mensuels + RLS granulaire sur Task

-- ============================================================
-- 1. Task RLS : admins/managers créent et assignent
--              les assignés peuvent changer leur statut
-- ============================================================
DROP POLICY IF EXISTS "task_write" ON "Task";

-- INSERT : réservé aux managers et admins
CREATE POLICY "task_insert" ON "Task"
  FOR INSERT WITH CHECK (public.get_user_role() IN ('Manager', 'Administrateur'));

-- DELETE : réservé aux managers et admins
CREATE POLICY "task_delete" ON "Task"
  FOR DELETE USING (public.get_user_role() IN ('Manager', 'Administrateur'));

-- UPDATE : managers/admins peuvent tout modifier
CREATE POLICY "task_update_manager" ON "Task"
  FOR UPDATE USING (public.get_user_role() IN ('Manager', 'Administrateur'));

-- UPDATE : l'assigné peut mettre à jour sa propre tâche (pour changer le statut)
CREATE POLICY "task_update_assignee" ON "Task"
  FOR UPDATE
  USING  (auth.uid() = "assigneeId")
  WITH CHECK (auth.uid() = "assigneeId");

-- ============================================================
-- 2. Table MonthlyObjective
-- ============================================================
CREATE TABLE IF NOT EXISTS "MonthlyObjective" (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  period       TEXT        NOT NULL DEFAULT 'month' CHECK (period IN ('week', 'month')),
  "targetDate" DATE        NOT NULL,
  indicator    TEXT,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed')),
  "clientId"   UUID        REFERENCES "Client"(id) ON DELETE SET NULL,
  "projectId"  UUID        REFERENCES "Project"(id) ON DELETE SET NULL,
  "createdBy"  UUID        REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS objective_status_date ON "MonthlyObjective" (status, "targetDate");

ALTER TABLE "MonthlyObjective" ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs connectés peuvent lire les objectifs
CREATE POLICY "objective_select" ON "MonthlyObjective"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seuls les managers et admins peuvent créer, modifier, supprimer
CREATE POLICY "objective_write" ON "MonthlyObjective"
  FOR ALL
  USING  (public.get_user_role() IN ('Manager', 'Administrateur'))
  WITH CHECK (public.get_user_role() IN ('Manager', 'Administrateur'));
