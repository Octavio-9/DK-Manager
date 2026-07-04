import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo:      { width: 36, height: 36, backgroundColor: '#9d3bf1', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logoTxt:   { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  title:     { fontSize: 20, fontFamily: 'Helvetica-Bold' },
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

export default function InvoicePDF({ invoice }) {
  const client = invoice.clientRel || {}
  const items  = invoice.items || []
  const totalPaid = items.reduce((sum, it) => sum + (Number(it.paid) || 0), 0)
  const createdDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('fr-FR')
    : '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerRow}>
          <View style={s.logo}><Text style={s.logoTxt}>DK</Text></View>
          <Text style={s.title}>REÇU DE PAIEMENT</Text>
          <View style={s.logo}><Text style={s.logoTxt}>DK</Text></View>
        </View>

        <View style={s.metaRow}>
          <View style={s.pill}><Text style={s.pillTxt}>Facture n°{invoice.invoiceNumber}</Text></View>
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
            <Text style={s.attnTxt}>{client.name || '—'}</Text>
            {client.phone ? <Text style={s.attnTxt}>{client.phone}</Text> : null}
            {client.email ? <Text style={s.attnTxt}>{client.email}</Text> : null}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={s.tHDesc}>DESCRIPTION</Text>
          <Text style={s.tHCell}>PRIX</Text>
          <Text style={s.tHCell}>PAYER</Text>
          <Text style={s.tHCell}>RESTE</Text>
        </View>
        {items.map((item, i) => {
          const prix  = (Number(item.price) || 0) * (Number(item.quantity) || 1)
          const payer = Number(item.paid) || 0
          const reste = Math.max(0, prix - payer)
          return (
            <View key={i} style={s.tRow}>
              <Text style={s.tCDesc}>{item.description}</Text>
              <Text style={s.tCell}>{fmtGNF(prix)}</Text>
              <Text style={s.tCell}>{fmtGNF(payer)}</Text>
              <Text style={s.tCell}>{fmtGNF(reste)}</Text>
            </View>
          )
        })}

        <View style={s.totalBar}>
          <Text style={s.totalLbl}>TOTAL :</Text>
          <Text style={s.totalVal}>{fmtGNF(totalPaid)}</Text>
        </View>

        <View style={s.footerRow}>
          <View>
            <Text style={s.paidBy}>Paiement effectué par {client.name || '—'}</Text>
            <Text style={s.condLbl}>Conditions de paiement</Text>
            <Text style={s.condTxt}>Paiement sous 15 jours</Text>
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
