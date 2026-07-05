// Aperçu HTML fidèle du document imprimé (voir InvoicePDF.jsx).
// S'adapte au type (facture / reçu) et se met à jour en temps réel.
import DKLogo from './DKLogo'

const COMPANY = {
  name: 'DK PRODUCTION',
  phone: '611-14-43-34',
  email: 'contact@dkproduction.space',
  address: 'Fossidet rond-point',
}

function fmtGNF(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' GNF'
}

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('fr-FR')
}

export default function InvoicePreview({
  documentType = 'FACTURE',
  clientName,
  items = [],
  dueDate,
  invoiceNumber,
  dateLabel,
}) {
  const isReceipt = documentType === 'RECU'
  const billedTotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
  const paidTotal = items.reduce((s, it) => s + (Number(it.paid) || 0), 0)
  const grandTotal = isReceipt ? paidTotal : billedTotal

  const title = isReceipt ? 'REÇU DE PAIEMENT' : 'FACTURE'
  const totalLabel = isReceipt ? 'TOTAL PAYÉ :' : 'TOTAL À PAYER :'
  const hasContent =
    items.filter((it) => (it.description || '').trim() || Number(it.price) || Number(it.paid)).length > 0
  const due = fmtDate(dueDate)

  return (
    <div className="mx-auto w-full max-w-[520px] rounded-lg bg-white p-6 text-[11px] leading-normal text-black shadow-lg sm:p-8">
      {/* En-tête : titre en grand à gauche, logo à droite */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className={`border-l-4 border-black pl-3 font-bold uppercase leading-none tracking-tight ${isReceipt ? 'text-[21px]' : 'text-[28px]'}`}>
          {title}
        </p>
        <DKLogo className="h-16 w-auto shrink-0" />
      </div>

      {/* Méta : n° document + date */}
      <div className="mb-5 flex gap-2">
        <span className="rounded-full border border-[#cccccc] px-3 py-1">
          {isReceipt ? 'Reçu' : 'Facture'} n°{invoiceNumber || '—'}
        </span>
        <span className="rounded-full border border-[#cccccc] px-3 py-1">{dateLabel}</span>
      </div>

      <div className="mb-4 border-b border-[#cccccc]" />

      {/* Émetteur / destinataire */}
      <div className="mb-5 flex justify-between gap-4">
        <div>
          <p className="mb-1 font-bold">{COMPANY.name}</p>
          <p className="text-[#444444]">{COMPANY.phone}</p>
          <p className="text-[#444444]">{COMPANY.email}</p>
          <p className="text-[#444444]">{COMPANY.address}</p>
        </div>
        <div className="text-right">
          <p className="mb-1 font-bold">À L'ATTENTION DE</p>
          <p className="text-[#444444]">{clientName?.trim() || '—'}</p>
        </div>
      </div>

      {/* Tableau des lignes */}
      <div>
        <div className="flex bg-black px-2 py-2 text-[10px] font-bold text-white">
          <span className="flex-[2]">DESCRIPTION</span>
          {isReceipt ? (
            <>
              <span className="flex-1 text-center">PRIX</span>
              <span className="flex-1 text-center">PAYER</span>
              <span className="flex-1 text-center">RESTE</span>
            </>
          ) : (
            <>
              <span className="flex-1 text-center">QTÉ</span>
              <span className="flex-1 text-center">P.U.</span>
              <span className="flex-1 text-center">TOTAL</span>
            </>
          )}
        </div>
        {!hasContent ? (
          <div className="border-b border-[#dddddd] px-2 py-3 text-center text-[#999999]">
            Ajoutez une ligne de prestation…
          </div>
        ) : (
          items.map((item, i) => {
            const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
            const payer = Number(item.paid) || 0
            const reste = Math.max(0, lineTotal - payer)
            return (
              <div key={i} className="flex border-b border-[#dddddd] px-2 py-2 text-[10px]">
                <span className="flex-[2] break-words pr-1">{item.description || '—'}</span>
                {isReceipt ? (
                  <>
                    <span className="flex-1 text-center">{fmtGNF(lineTotal)}</span>
                    <span className="flex-1 text-center">{fmtGNF(payer)}</span>
                    <span className="flex-1 text-center">{fmtGNF(reste)}</span>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-center">{Number(item.quantity) || 1}</span>
                    <span className="flex-1 text-center">{fmtGNF(Number(item.price) || 0)}</span>
                    <span className="flex-1 text-center">{fmtGNF(lineTotal)}</span>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Barre de total */}
      <div className="mt-0.5 flex items-center justify-end bg-black px-4 py-3">
        <span className="mr-3 text-[11px] font-bold text-white">{totalLabel}</span>
        <span className="text-sm font-bold text-white">{fmtGNF(grandTotal)}</span>
      </div>

      {/* Pied */}
      <div className="mt-8 flex justify-between gap-4">
        <div>
          {isReceipt ? (
            <p className="mb-4">Paiement effectué par {clientName?.trim() || '—'}</p>
          ) : (
            <p className="mb-4">
              {due ? `À régler avant le ${due}` : 'À régler dès réception'}
            </p>
          )}
          <p className="font-bold">Conditions de paiement</p>
          <p className="text-[#444444]">Paiement sous 15 jours</p>
        </div>
        <div className="w-40 text-center">
          <div className="mb-1 border-t border-black" />
          <p>Le Directeur Général</p>
        </div>
      </div>

      <p className="mt-6 border-t border-[#cccccc] pt-3 text-center font-bold">
        MERCI DE VOTRE CONFIANCE
      </p>
    </div>
  )
}
