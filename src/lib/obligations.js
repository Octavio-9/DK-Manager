import { supabase } from './supabase'

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export async function fetchObligationTemplates() {
  const { data, error } = await supabase
    .from('ObligationTemplate')
    .select('*, categoryRel:FinanceCategory(id, name)')
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchObligationEntries(month) {
  const { data, error } = await supabase
    .from('ObligationEntry')
    .select('*, categoryRel:FinanceCategory(id, name)')
    .eq('month', month)
    .order('name')
  if (error) throw error
  return data || []
}

export async function generateMissingEntries(month, templates, existingEntries) {
  const existingTemplateIds = new Set(existingEntries.map((e) => e.templateId).filter(Boolean))
  const missing = templates.filter((t) => t.active && !existingTemplateIds.has(t.id))
  if (missing.length === 0) return []

  const rows = missing.map((t) => ({
    templateId: t.id,
    month,
    name: t.name,
    amount: t.defaultAmount,
    categoryId: t.categoryId,
  }))

  const { data, error } = await supabase
    .from('ObligationEntry')
    .insert(rows)
    .select('*, categoryRel:FinanceCategory(id, name)')
  if (error) throw error
  return data || []
}

export async function payObligationEntry(entry, { amount, paidDate }) {
  const { data: tx, error: txError } = await supabase
    .from('Transaction')
    .insert({
      type: 'EXPENSE',
      amount,
      categoryId: entry.categoryId,
      description: entry.name,
      date: paidDate,
    })
    .select()
    .single()
  if (txError) throw txError

  const { error } = await supabase
    .from('ObligationEntry')
    .update({ done: true, amount, paidDate, transactionId: tx.id })
    .eq('id', entry.id)
  if (error) throw error
}

export async function unpayObligationEntry(entry) {
  if (entry.transactionId) {
    const { error: txError } = await supabase.from('Transaction').delete().eq('id', entry.transactionId)
    if (txError) throw txError
  }
  const { error } = await supabase
    .from('ObligationEntry')
    .update({ done: false, paidDate: null, transactionId: null })
    .eq('id', entry.id)
  if (error) throw error
}

export async function saveObligationTemplate(payload, editingId) {
  if (editingId) {
    const { error } = await supabase.from('ObligationTemplate').update(payload).eq('id', editingId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('ObligationTemplate').insert(payload)
    if (error) throw error
  }
}

export async function setObligationTemplateActive(id, active) {
  const { error } = await supabase.from('ObligationTemplate').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteObligationEntry(entry) {
  // Supprime la transaction de paiement associée si l'échéance était payée,
  // pour ne pas laisser de dépense orpheline dans les finances.
  if (entry.transactionId) {
    const { error: txError } = await supabase.from('Transaction').delete().eq('id', entry.transactionId)
    if (txError) throw txError
  }
  const { error } = await supabase.from('ObligationEntry').delete().eq('id', entry.id)
  if (error) throw error
}

export async function deleteObligationTemplate(id) {
  // Retire d'abord les échéances non payées liées à ce modèle, pour qu'il
  // disparaisse aussi du mois courant. Les échéances déjà payées sont
  // conservées comme historique (elles gardent leur montant et leur transaction).
  const { error: entriesError } = await supabase
    .from('ObligationEntry')
    .delete()
    .eq('templateId', id)
    .eq('done', false)
  if (entriesError) throw entriesError

  const { error } = await supabase.from('ObligationTemplate').delete().eq('id', id)
  if (error) throw error
}
