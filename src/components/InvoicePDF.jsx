import { Document, Page, Text, View, StyleSheet, Image, Svg, Circle, Rect, Path } from '@react-pdf/renderer'

const COMPANY = {
  name: 'DK PRODUCTION',
  phone: '611-14-43-34',
  email: 'contact@dkproduction.space',
  address: 'Fossidet rond-point',
}

function fmtGNF(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' GNF'
}

const s = StyleSheet.create({
  page:      { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#000000' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  titleWrap: { borderLeftWidth: 4, borderLeftColor: '#111111', paddingLeft: 12, flexShrink: 1, marginRight: 12 },
  title:     { fontSize: 32, fontFamily: 'Helvetica-Bold', color: '#111111' },
  titleSm:   { fontSize: 24 },
  logoImg:   { width: 78, height: 78, objectFit: 'contain' },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, width: 100, justifyContent: 'flex-end' },
  camera:    { width: 34, height: 37 },
  brandName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#111111' },
  brandSub:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#111111' },
  metaRow:   { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill:      { borderRadius: 20, borderWidth: 1, borderColor: '#cccccc', paddingHorizontal: 12, paddingVertical: 4 },
  pillTxt:   { fontSize: 10 },
  divider:   { borderBottomWidth: 1, borderBottomColor: '#cccccc', marginBottom: 16 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  infoLbl:   { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  infoTxt:   { fontSize: 9, color: '#444444', lineHeight: 1.5 },
  attnLbl:   { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 4 },
  attnTxt:   { fontSize: 9, color: '#444444', textAlign: 'right', lineHeight: 1.5 },
  tHead:     { flexDirection: 'row', backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 6 },
  tHDesc:    { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 2 },
  tHCell:    { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 1, textAlign: 'center' },
  tRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#dddddd', paddingVertical: 8, paddingHorizontal: 6 },
  tCDesc:    { fontSize: 9, flex: 2 },
  tCell:     { fontSize: 9, flex: 1, textAlign: 'center' },
  totalBar:  { backgroundColor: '#000000', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 2 },
  totalLbl:  { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold', marginRight: 12 },
  totalVal:  { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  paidBy:    { fontSize: 10, marginBottom: 20 },
  condLbl:   { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  condTxt:   { fontSize: 9, color: '#444444' },
  sigZone:   { alignItems: 'center', width: 160 },
  sigLine:   { borderTopWidth: 1, borderTopColor: '#000000', width: '100%', marginBottom: 4 },
  sigTxt:    { fontSize: 9, textAlign: 'center' },
  thanks:    { textAlign: 'center', fontSize: 10, fontFamily: 'Helvetica-Bold', borderTopWidth: 1, borderTopColor: '#cccccc', paddingTop: 12, marginTop: 24 },
})

export default function InvoicePDF({ invoice, logoSrc }) {
  const client = invoice.clientRel || {}
  const clientName = invoice.clientRel?.name || invoice.clientName || '—'
  const items  = invoice.items || []
  const isReceipt = invoice.documentType === 'RECU'
  const billedTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
  const paidTotal = items.reduce((sum, it) => sum + (Number(it.paid) || 0), 0)
  const grandTotal = isReceipt ? paidTotal : billedTotal
  const createdDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('fr-FR')
    : '—'
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : null

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerRow}>
          <View style={s.titleWrap}>
            <Text style={isReceipt ? [s.title, s.titleSm] : s.title}>
              {isReceipt ? 'REÇU DE PAIEMENT' : 'FACTURE'}
            </Text>
          </View>
          {logoSrc ? (
            <Image src={logoSrc} style={s.logoImg} />
          ) : (
            <View style={s.brandRow}>
              <Svg viewBox="0 0 130 140" style={s.camera}>
                <Circle cx="70" cy="42" r="26" fill="#111111" />
                <Circle cx="34" cy="52" r="18" fill="#111111" />
                <Rect x="18" y="62" width="72" height="60" rx="8" fill="#111111" />
                <Path d="M90 78 L90 118 L128 98 Z" fill="#111111" />
                <Path d="M32 96 L32 78 L52 78" stroke="#ffffff" strokeWidth="5" fill="none" />
              </Svg>
              <View>
                <Text style={s.brandName}>D-K</Text>
                <Text style={s.brandSub}>PRODUCTION</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.metaRow}>
          <View style={s.pill}><Text style={s.pillTxt}>{isReceipt ? 'Reçu' : 'Facture'} n°{invoice.invoiceNumber}</Text></View>
          <View style={s.pill}><Text style={s.pillTxt}>{createdDate}</Text></View>
        </View>

        <View style={s.divider} />

        <View style={s.infoRow}>
          <View>
            <Text style={s.infoLbl}>{COMPANY.name}</Text>
            <Text style={s.infoTxt}>{COMPANY.phone}</Text>
            <Text style={s.infoTxt}>{COMPANY.email}</Text>
            <Text style={s.infoTxt}>{COMPANY.address}</Text>
          </View>
          <View>
            <Text style={s.attnLbl}>À L'ATTENTION DE</Text>
            <Text style={s.attnTxt}>{clientName}</Text>
            {client.phone ? <Text style={s.attnTxt}>{client.phone}</Text> : null}
            {client.email ? <Text style={s.attnTxt}>{client.email}</Text> : null}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={s.tHDesc}>DESCRIPTION</Text>
          {isReceipt ? (
            <>
              <Text style={s.tHCell}>PRIX</Text>
              <Text style={s.tHCell}>PAYER</Text>
              <Text style={s.tHCell}>RESTE</Text>
            </>
          ) : (
            <>
              <Text style={s.tHCell}>QTÉ</Text>
              <Text style={s.tHCell}>P.U.</Text>
              <Text style={s.tHCell}>TOTAL</Text>
            </>
          )}
        </View>
        {items.map((item, i) => {
          const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
          const payer = Number(item.paid) || 0
          const reste = Math.max(0, lineTotal - payer)
          return (
            <View key={i} style={s.tRow}>
              <Text style={s.tCDesc}>{item.description}</Text>
              {isReceipt ? (
                <>
                  <Text style={s.tCell}>{fmtGNF(lineTotal)}</Text>
                  <Text style={s.tCell}>{fmtGNF(payer)}</Text>
                  <Text style={s.tCell}>{fmtGNF(reste)}</Text>
                </>
              ) : (
                <>
                  <Text style={s.tCell}>{Number(item.quantity) || 1}</Text>
                  <Text style={s.tCell}>{fmtGNF(Number(item.price) || 0)}</Text>
                  <Text style={s.tCell}>{fmtGNF(lineTotal)}</Text>
                </>
              )}
            </View>
          )
        })}

        <View style={s.totalBar}>
          <Text style={s.totalLbl}>{isReceipt ? 'TOTAL PAYÉ :' : 'TOTAL À PAYER :'}</Text>
          <Text style={s.totalVal}>{fmtGNF(grandTotal)}</Text>
        </View>

        <View style={s.footerRow}>
          <View>
            {isReceipt ? (
              <Text style={s.paidBy}>Paiement effectué par {clientName}</Text>
            ) : (
              <Text style={s.paidBy}>{dueDate ? `À régler avant le ${dueDate}` : 'À régler dès réception'}</Text>
            )}
            <Text style={s.condLbl}>Conditions de paiement</Text>
            <Text style={s.condTxt}>{invoice.paymentTerms?.trim() || 'Paiement sous 15 jours'}</Text>
          </View>
          <View style={s.sigZone}>
            <View style={s.sigLine} />
            <Text style={s.sigTxt}>Le Directeur Général</Text>
          </View>
        </View>

        <Text style={s.thanks}>MERCI DE VOTRE CONFIANCE</Text>
      </Page>
    </Document>
  )
}
