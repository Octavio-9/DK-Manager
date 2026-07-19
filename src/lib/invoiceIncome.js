import { supabase } from './supabase'

// Id (mis en cache) de la catégorie de revenu « Facturation ».
let _facturationCategoryId

async function getFacturationCategoryId() {
  if (_facturationCategoryId !== undefined) return _facturationCategoryId
  const { data } = await supabase
    .from('FinanceCategory')
    .select('id')
    .eq('name', 'Facturation')
    .maybeSingle()
  _facturationCategoryId = data?.id || null
  return _facturationCategoryId
}

// Un revenu est attendu quand le document est payé, SAUF s'il s'agit d'un reçu
// généré à partir d'une facture (le revenu a déjà été compté via la facture source).
// → évite le double comptage facture + reçu.
function shouldHaveIncome(invoice) {
  return (
    invoice.status === 'PAID' &&
    !(invoice.documentType === 'RECU' && invoice.sourceInvoiceId)
  )
}

/**
 * Synchronise la transaction Revenu liée à une facture après son enregistrement.
 * Crée / met à jour / supprime la transaction selon le statut de la facture.
 *
 * invoice: {
 *   id, status, total, documentType, sourceInvoiceId,
 *   transactionId,        // transaction déjà liée (ou null)
 *   clientId, clientLabel, invoiceNumber
 * }
 */
export async function syncInvoiceIncome(invoice) {
  const existingTxId = invoice.transactionId || null

  if (shouldHaveIncome(invoice)) {
    const description =
      `${invoice.documentType === 'RECU' ? 'Reçu' : 'Facture'} ${invoice.invoiceNumber || ''}`.trim() +
      (invoice.clientLabel ? ` — ${invoice.clientLabel}` : '')

    if (existingTxId) {
      // Garder la transaction en phase (montant / libellé / client)
      const { error } = await supabase
        .from('Transaction')
        .update({ amount: invoice.total, description, clientId: invoice.clientId || null })
        .eq('id', existingTxId)
      if (error) throw error
    } else {
      // Créer la transaction Revenu et la relier à la facture
      const categoryId = await getFacturationCategoryId()
      const { data: tx, error } = await supabase
        .from('Transaction')
        .insert({
          type: 'INCOME',
          amount: invoice.total,
          categoryId,
          clientId: invoice.clientId || null,
          description,
          date: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single()
      if (error) throw error
      const { error: linkErr } = await supabase
        .from('Invoice')
        .update({ transactionId: tx.id })
        .eq('id', invoice.id)
      if (linkErr) throw linkErr
    }
  } else if (existingTxId) {
    // Réversibilité : la facture n'est plus payée (ou annulée) → on retire le revenu.
    const { error } = await supabase.from('Transaction').delete().eq('id', existingTxId)
    if (error) throw error
    const { error: unlinkErr } = await supabase
      .from('Invoice')
      .update({ transactionId: null })
      .eq('id', invoice.id)
    if (unlinkErr) throw unlinkErr
  }
}
