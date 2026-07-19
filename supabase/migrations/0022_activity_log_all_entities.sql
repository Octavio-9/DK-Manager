-- Migration 0022 — Journal d'activité étendu à toute l'application
-- ============================================================
-- Étend la traçabilité (table ActivityLog + fonction log_activity de la
-- migration 0018) à toutes les tables métier, pour que chaque création /
-- modification / suppression, sur n'importe quelle page, soit historisée.
--
-- Exclus volontairement (bruit ou non pertinent) :
--   Notification, ChatMessage, PushSubscription, ActivityLog,
--   InvoiceItem & ProductionFile (lignes enfants), ObligationEntry
--   (auto-générée chaque mois), Role/ProjectType/EventType (config).
-- ============================================================

-- 1. Améliore le libellé capturé (ajout de invoiceNumber et description
--    pour les factures et transactions qui n'ont ni title ni name).
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  act text;
begin
  if (TG_OP = 'DELETE') then
    rec := to_jsonb(OLD);
    act := 'deleted';
  elsif (TG_OP = 'UPDATE') then
    rec := to_jsonb(NEW);
    act := 'updated';
  else
    rec := to_jsonb(NEW);
    act := 'created';
  end if;

  insert into "ActivityLog" (entity, "entityId", action, "entityLabel", "userId")
  values (
    TG_TABLE_NAME,
    (rec->>'id')::uuid,
    act,
    coalesce(rec->>'title', rec->>'name', rec->>'invoiceNumber', rec->>'description', rec->>'clientName'),
    auth.uid()
  );

  if (TG_OP = 'DELETE') then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- 2. Branche le trigger sur toutes les tables métier suivies (idempotent).
do $$
declare
  t text;
  tables text[] := array[
    'Client', 'ClientContact', 'Production', 'Invoice', 'Transaction',
    'Document', 'FinanceCategory', 'ObligationTemplate', 'SocialPost',
    'MonthlyBoard', 'User'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists log_activity_%s on %I', lower(t), t);
    execute format(
      'create trigger log_activity_%s after insert or update or delete on %I
         for each row execute procedure public.log_activity()',
      lower(t), t
    );
  end loop;
end $$;
