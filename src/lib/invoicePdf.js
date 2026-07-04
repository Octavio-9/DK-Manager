// Dynamic imports — @react-pdf/renderer is loaded lazily on demand only,
// never at app startup (avoids CJS/ESM issues with its base64-js dependency).
export async function downloadInvoicePDF(invoice) {
  const [{ pdf }, { createElement }, { default: InvoicePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../components/InvoicePDF.jsx'),
  ])
  const element = createElement(InvoicePDF, { invoice })
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recu-${invoice.invoiceNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
