// Document imprimé (facture / reçu) — mise en page « DK PRODUCTION SARL ».
// L'aperçu HTML temps réel (InvoicePreview.jsx) reproduit fidèlement ce rendu.
import { Document, Page, Text, View, StyleSheet, Image, Svg, Circle, Rect, Path } from '@react-pdf/renderer'
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

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 44,
    paddingBottom: 76,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#111111',
  },

  /* En-tête : logo à gauche, titre + méta à droite */
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoImg:    { width: 104, height: 52, objectFit: 'contain' },
  logoSvgBox: { width: 104 },
  logoSvg:    { width: 46, height: 50 },
  logoWord:   { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginTop: 3 },
  metaCol:    { alignItems: 'flex-end' },
  title:      { fontSize: 27, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  titleSm:    { fontSize: 19, letterSpacing: 2 },
  metaLine:   { fontSize: 8.5, color: '#666666', marginTop: 5 },
  metaVal:    { fontFamily: 'Helvetica-Bold', color: '#111111' },

  /* Bloc société sous le logo */
  compBlock: { marginTop: 16 },
  compName:  { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  compTxt:   { fontSize: 8.5, color: '#555555', marginTop: 2.5 },

  rule: { borderBottomWidth: 2, borderBottomColor: '#111111', marginTop: 18, marginBottom: 22 },

  /* Destinataire */
  billLbl:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, color: '#888888' },
  billName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  billTxt:  { fontSize: 8.5, color: '#555555', marginTop: 2.5 },

  /* Tableau */
  tHead:  { flexDirection: 'row', backgroundColor: '#111111', paddingVertical: 9, paddingHorizontal: 11, marginTop: 26 },
  th:     { color: '#ffffff', fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.9 },
  tRow:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e6e6e6', paddingVertical: 11, paddingHorizontal: 11 },
  cDesc:  { flex: 1, paddingRight: 8 },
  cQty:   { width: 46, textAlign: 'center' },
  cUnit:  { width: 116, textAlign: 'right' },
  cAmt:   { width: 106, textAlign: 'right' },
  cTri:   { width: 108, textAlign: 'right' },
  cell:   { fontSize: 9 },

  /* Totaux */
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  totalsBox:  { width: 268 },
  totRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 11 },
  totLbl:     { fontSize: 9, color: '#555555' },
  totVal:     { fontSize: 9 },
  totalBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111111', paddingVertical: 11, paddingHorizontal: 11, marginTop: 6 },
  totalLbl:   { color: '#ffffff', fontSize: 10.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  totalVal:   { color: '#ffffff', fontSize: 12.5, fontFamily: 'Helvetica-Bold' },

  /* Conditions de paiement */
  condWrap: { marginTop: 40 },
  condLbl:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, color: '#111111', marginBottom: 6 },
  condTxt:  { fontSize: 8.5, color: '#555555', lineHeight: 1.5 },

  /* Pied de page */
  footer:       { position: 'absolute', bottom: 34, left: 44, right: 44, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 12 },
  footerTxt:    { fontSize: 7.5, textAlign: 'center', color: '#777777' },
  footerStrong: { fontFamily: 'Helvetica-Bold', color: '#555555' },
})

export default function InvoicePDF({ invoice, logoSrc }) {
  const client = invoice.clientRel || {}
  const clientName = invoice.clientRel?.name || invoice.clientName || '—'
  const items = invoice.items || []
  const isReceipt = invoice.documentType === 'RECU'

  const billedTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
  const paidTotal = items.reduce((sum, it) => sum + (Number(it.paid) || 0), 0)
  const grandTotal = isReceipt ? paidTotal : billedTotal

  const createdDate = fmtLongDate(invoice.createdAt) || fmtLongDate(new Date())
  const dueDate = fmtLongDate(invoice.dueDate)

  const termsLines = (invoice.paymentTerms?.trim() || DEFAULT_PAYMENT_TERMS).split('\n')

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.headerRow}>
          {logoSrc ? (
            <Image src={logoSrc} style={s.logoImg} />
          ) : (
            <View style={s.logoSvgBox}>
              <Svg viewBox="0 0 130 140" style={s.logoSvg}>
                <Circle cx="70" cy="42" r="26" fill="#111111" />
                <Circle cx="34" cy="52" r="18" fill="#111111" />
                <Rect x="18" y="62" width="72" height="60" rx="8" fill="#111111" />
                <Path d="M90 78 L90 118 L128 98 Z" fill="#111111" />
              </Svg>
              <Text style={s.logoWord}>PRODUCTION</Text>
            </View>
          )}

          <View style={s.metaCol}>
            <Text style={isReceipt ? [s.title, s.titleSm] : s.title}>
              {isReceipt ? 'REÇU' : 'FACTURE'}
            </Text>
            <Text style={s.metaLine}>
              N° <Text style={s.metaVal}>{invoice.invoiceNumber || '—'}</Text>
            </Text>
            <Text style={s.metaLine}>
              Date <Text style={s.metaVal}>{createdDate}</Text>
            </Text>
            {dueDate ? (
              <Text style={s.metaLine}>
                Échéance <Text style={s.metaVal}>{dueDate}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Société émettrice */}
        <View style={s.compBlock}>
          <Text style={s.compName}>{COMPANY.name}</Text>
          <Text style={s.compTxt}>{COMPANY.city}</Text>
          <Text style={s.compTxt}>Tél : {COMPANY.phone}  |  Email : {COMPANY.email}</Text>
        </View>

        <View style={s.rule} />

        {/* Destinataire */}
        <View>
          <Text style={s.billLbl}>{isReceipt ? 'REÇU DE' : 'FACTURÉ À'}</Text>
          <Text style={s.billName}>{clientName}</Text>
          {client.phone ? <Text style={s.billTxt}>{client.phone}</Text> : null}
          {client.email ? <Text style={s.billTxt}>{client.email}</Text> : null}
        </View>

        {/* Tableau des prestations */}
        <View style={s.tHead}>
          <Text style={[s.th, s.cDesc]}>DESCRIPTION</Text>
          {isReceipt ? (
            <>
              <Text style={[s.th, s.cTri]}>MONTANT (GNF)</Text>
              <Text style={[s.th, s.cTri]}>PAYÉ (GNF)</Text>
              <Text style={[s.th, s.cTri]}>RESTE (GNF)</Text>
            </>
          ) : (
            <>
              <Text style={[s.th, s.cQty]}>QTÉ</Text>
              <Text style={[s.th, s.cUnit]}>PRIX UNITAIRE (GNF)</Text>
              <Text style={[s.th, s.cAmt]}>MONTANT (GNF)</Text>
            </>
          )}
        </View>

        {items.map((item, i) => {
          const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
          const payer = Number(item.paid) || 0
          const reste = Math.max(0, lineTotal - payer)
          return (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={[s.cell, s.cDesc]}>{item.description || '—'}</Text>
              {isReceipt ? (
                <>
                  <Text style={[s.cell, s.cTri]}>{fmtNum(lineTotal)}</Text>
                  <Text style={[s.cell, s.cTri]}>{fmtNum(payer)}</Text>
                  <Text style={[s.cell, s.cTri]}>{fmtNum(reste)}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.cell, s.cQty]}>{Number(item.quantity) || 1}</Text>
                  <Text style={[s.cell, s.cUnit]}>{fmtNum(Number(item.price) || 0)}</Text>
                  <Text style={[s.cell, s.cAmt]}>{fmtNum(lineTotal)}</Text>
                </>
              )}
            </View>
          )
        })}

        {/* Totaux */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLbl}>Sous-total</Text>
              <Text style={s.totVal}>{fmtGNF(billedTotal)}</Text>
            </View>
            {isReceipt ? (
              <View style={s.totRow}>
                <Text style={s.totLbl}>Reste à payer</Text>
                <Text style={s.totVal}>{fmtGNF(Math.max(0, billedTotal - paidTotal))}</Text>
              </View>
            ) : (
              <View style={s.totRow}>
                <Text style={s.totLbl}>TVA</Text>
                <Text style={s.totVal}>—</Text>
              </View>
            )}
            <View style={s.totalBar}>
              <Text style={s.totalLbl}>{isReceipt ? 'TOTAL PAYÉ' : 'TOTAL À PAYER'}</Text>
              <Text style={s.totalVal}>{fmtGNF(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Conditions de paiement (modifiables document par document) */}
        <View style={s.condWrap}>
          <Text style={s.condLbl}>CONDITIONS DE PAIEMENT</Text>
          {termsLines.map((line, i) => (
            <Text key={i} style={s.condTxt}>{line}</Text>
          ))}
        </View>

        {/* Pied de page */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>
            <Text style={s.footerStrong}>{COMPANY.name}</Text>
            {'  •  '}{COMPANY.city}{'  •  '}Merci de votre confiance
          </Text>
        </View>
      </Page>
    </Document>
  )
}
