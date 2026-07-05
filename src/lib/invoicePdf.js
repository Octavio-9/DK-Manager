// Charge le logo /dk-logo.png en data URL s'il existe (sinon null → SVG de secours).
// Garde-fou : une SPA renvoie souvent index.html (200) pour un fichier manquant,
// donc on vérifie que le type MIME est bien une image.
async function loadLogoDataUrl() {
  try {
    const res = await fetch('/DK.jpeg')
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Dynamic imports — @react-pdf/renderer is loaded lazily on demand only,
// never at app startup (avoids CJS/ESM issues with its base64-js dependency).
export async function downloadInvoicePDF(invoice) {
  const [{ pdf }, { createElement }, { default: InvoicePDF }, logoSrc] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../components/InvoicePDF.jsx'),
    loadLogoDataUrl(),
  ])
  const element = createElement(InvoicePDF, { invoice, logoSrc })
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
