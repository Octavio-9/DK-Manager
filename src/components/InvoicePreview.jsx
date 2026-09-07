// Aperçu HTML fidèle du document imprimé (voir InvoicePDF.jsx).
// S'adapte au type (facture / reçu) et se met à jour en temps réel.
import DKLogo from './DKLogo'
import { INVOICE_COMPANY as COMPANY, DEFAULT_PAYMENT_TERMS } from '../lib/constants'

function fmtNum(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0)
}

function fmtGNF(value) {
  return fmtNum(value) + ' GNF'
}

function fmtLongDate(d) {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function InvoicePreview({
  documentType = 'FACTURE',
  clientName,
  items = [],
  dueDate,
  paymentTerms,
  invoiceNumber,
  createdAt,
}) {
  const isReceipt = documentType === 'RECU'
  const billedTotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
  const paidTotal = items.reduce((s, it) => s + (Number(it.paid) || 0), 0)
  const grandTotal = isReceipt ? paidTotal : billedTotal

  const hasContent =
    items.filter((it) => (it.description || '').trim() || Number(it.price) || Number(it.paid)).length > 0

  const createdLabel = fmtLongDate(createdAt) || fmtLongDate(new Date())
  const dueLabel = fmtLongDate(dueDate)
  const terms = (paymentTerms?.trim() || DEFAULT_PAYMENT_TERMS)

  return (
    <div className="mx-auto w-full max-w-[520px] rounded-lg bg-white p-6 text-[10px] leading-normal text-[#111111] shadow-lg sm:p-8">
      {/* En-tête : logo à gauche, titre + méta à droite */}
      <div className="flex items-start justify-between gap-4">
        <DKLogo className="h-12 w-auto shrink-0" />
        <div className="text-right">
          <p className={`font-bold leading-none ${isReceipt ? 'text-[19px] tracking-[0.12em]' : 'text-[25px] tracking-[0.18em]'}`}>
            {isReceipt ? 'REÇU' : 'FACTURE'}
          </p>
          <p className="mt-1.5 text-[9px] text-[#666666]">
            N° <span className="font-bold text-[#111111]">{invoiceNumber || '—'}</span>
          </p>
          <p className="mt-1 text-[9px] text-[#666666]">
            Date <span className="font-bold text-[#111111]">{createdLabel}</span>
          </p>
          {dueLabel && (
            <p className="mt-1 text-[9px] text-[#666666]">
              Échéance <span className="font-bold text-[#111111]">{dueLabel}</span>
            </p>
          )}
        </div>
      </div>

      {/* Société émettrice */}
      <div className="mt-4">
        <p className="font-bold">{COMPANY.name}</p>
        <p className="mt-0.5 text-[9px] text-[#555555]">{COMPANY.city}</p>
        <p className="mt-0.5 text-[9px] text-[#555555]">
          Tél : {COMPANY.phone} &nbsp;|&nbsp; Email : {COMPANY.email}
        </p>
      </div>

      <div className="my-5 border-b-2 border-[#111111]" />

      {/* Destinataire */}
      <div>
        <p className="text-[8px] font-bold tracking-[0.15em] text-[#888888]">
          {isReceipt ? 'REÇU DE' : 'FACTURÉ À'}
        </p>
        <p className="mt-1.5 text-[14px] font-bold">{clientName?.trim() || '—'}</p>
      </div>

      {/* Tableau des prestations */}
      <div className="mt-6">
        <div className="flex bg-[#111111] px-2.5 py-2 text-[8px] font-bold tracking-[0.08em] text-white">
          <span className="flex-1 pr-2">DESCRIPTION</span>
          {isReceipt ? (
            <>
              <span className="w-[70px] text-right">MONTANT</span>
              <span className="w-[70px] text-right">PAYÉ</span>
              <span className="w-[70px] text-right">RESTE</span>
            </>
          ) : (
            <>
              <span className="w-[34px] text-center">QTÉ</span>
              <span className="w-[86px] text-right">PRIX UNIT. (GNF)</span>
              <span className="w-[76px] text-right">MONTANT (GNF)</span>
            </>
          )}
        </div>

        {!hasContent ? (
          <div className="border-b border-[#e6e6e6] px-2.5 py-3 text-center text-[#999999]">
            Ajoutez une ligne de prestation…
          </div>
        ) : (
          items.map((item, i) => {
            const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
            const payer = Number(item.paid) || 0
            const reste = Math.max(0, lineTotal - payer)
            return (
              <div key={i} className="flex border-b border-[#e6e6e6] px-2.5 py-2.5">
                <span className="flex-1 break-words pr-2">{item.description || '—'}</span>
                {isReceipt ? (
                  <>
                    <span className="w-[70px] text-right">{fmtNum(lineTotal)}</span>
                    <span className="w-[70px] text-right">{fmtNum(payer)}</span>
                    <span className="w-[70px] text-right">{fmtNum(reste)}</span>
                  </>
                ) : (
                  <>
                    <span className="w-[34px] text-center">{Number(item.quantity) || 1}</span>
                    <span className="w-[86px] text-right">{fmtNum(Number(item.price) || 0)}</span>
                    <span className="w-[76px] text-right">{fmtNum(lineTotal)}</span>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Totaux */}
      <div className="mt-4 flex justify-end">
        <div className="w-[62%]">
          <div className="flex justify-between px-2.5 py-1.5">
            <span className="text-[#555555]">Sous-total</span>
            <span>{fmtGNF(billedTotal)}</span>
          </div>
          <div className="flex justify-between px-2.5 py-1.5">
            <span className="text-[#555555]">{isReceipt ? 'Reste à payer' : 'TVA'}</span>
            <span>{isReceipt ? fmtGNF(Math.max(0, billedTotal - paidTotal)) : '—'}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between bg-[#111111] px-2.5 py-2.5">
            <span className="text-[10px] font-bold tracking-[0.04em] text-white">
              {isReceipt ? 'TOTAL PAYÉ' : 'TOTAL À PAYER'}
            </span>
            <span className="text-[12px] font-bold text-white">{fmtGNF(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Conditions de paiement */}
      <div className="mt-9">
        <p className="mb-1.5 text-[8px] font-bold tracking-[0.14em]">CONDITIONS DE PAIEMENT</p>
        <p className="whitespace-pre-line text-[9px] leading-relaxed text-[#555555]">{terms}</p>
      </div>

      {/* Pied de page */}
      <div className="mt-8 border-t border-[#e0e0e0] pt-3">
        <p className="text-center text-[8px] text-[#777777]">
          <span className="font-bold text-[#555555]">{COMPANY.name}</span>
          {'  •  '}{COMPANY.city}{'  •  '}Merci de votre confiance
        </p>
      </div>
    </div>
  )
}
