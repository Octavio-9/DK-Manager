-- Migration 0015 — Tableau d'objectifs mensuels (dashboard)
-- Une ligne par mois : toute la structure du tableau est stockée en JSONB.

CREATE TABLE IF NOT EXISTS "MonthlyBoard" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month       INT         NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INT         NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{"metrics":[],"generalObjectives":[]}'::jsonb,
  "createdBy" UUID        REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month, year)
);

ALTER TABLE "MonthlyBoard" ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur connecté
DROP POLICY IF EXISTS "board_select" ON "MonthlyBoard";
CREATE POLICY "board_select" ON "MonthlyBoard"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Écriture : managers/admins uniquement
DROP POLICY IF EXISTS "board_write" ON "MonthlyBoard";
CREATE POLICY "board_write" ON "MonthlyBoard"
  FOR ALL
  USING  (public.get_user_role() IN ('Manager', 'Administrateur'))
  WITH CHECK (public.get_user_role() IN ('Manager', 'Administrateur'));

-- Tenir "updatedAt" à jour (réutilise la fonction set_updated_at existante)
DROP TRIGGER IF EXISTS monthly_board_updated_at ON "MonthlyBoard";
CREATE TRIGGER monthly_board_updated_at
  BEFORE UPDATE ON "MonthlyBoard"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
