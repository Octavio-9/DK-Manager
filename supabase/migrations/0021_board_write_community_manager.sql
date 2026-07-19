-- Migration 0021 — Community manager peut éditer le tableau d'objectifs mensuels
-- ============================================================
-- Élargit la policy d'écriture de "MonthlyBoard" (dashboard) pour inclure
-- le rôle « Community manager », en plus de Manager et Administrateur.
-- Sans ça, l'interface autorise l'édition mais la base rejette la sauvegarde.
-- ============================================================

DROP POLICY IF EXISTS "board_write" ON "MonthlyBoard";
CREATE POLICY "board_write" ON "MonthlyBoard"
  FOR ALL
  USING  (public.get_user_role() IN ('Manager', 'Administrateur', 'Community manager'))
  WITH CHECK (public.get_user_role() IN ('Manager', 'Administrateur', 'Community manager'));
