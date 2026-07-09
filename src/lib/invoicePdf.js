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
async function buildInvoiceBlob(invoice) {
  const [{ pdf }, { createElement }, { default: InvoicePDF }, logoSrc] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../components/InvoicePDF.jsx'),
    loadLogoDataUrl(),
  ])
  const element = createElement(InvoicePDF, { invoice, logoSrc })
  return pdf(element).toBlob()
}

// Préfixe du nom de fichier selon le type de document (facture / reçu)
function fileBaseName(invoice) {
  const prefix = invoice.documentType === 'RECU' ? 'recu' : 'facture'
  return `${prefix}-${invoice.invoiceNumber}`
}

// Télécharge le PDF (facture ou reçu)
export async function downloadInvoicePDF(invoice) {
  const blob = await buildInvoiceBlob(invoice)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBaseName(invoice)}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Ouvre directement la boîte de dialogue d'impression du navigateur.
// Rend le PDF dans un iframe caché puis appelle print() ; repli sur un
// nouvel onglet si le navigateur bloque l'impression dans l'iframe.
export async function printInvoicePDF(invoice) {
  const blob = await buildInvoiceBlob(invoice)
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    URL.revokeObjectURL(url)
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }

  iframe.onload = () => {
    // Laisse le visualiseur PDF se charger avant de lancer l'impression
    setTimeout(() => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.addEventListener?.('afterprint', cleanup)
        iframe.contentWindow.print()
      } catch {
        // Repli : ouvre le PDF dans un nouvel onglet (l'utilisateur imprime avec Ctrl+P)
        window.open(url, '_blank')
      }
      // Filet de sécurité : nettoyage même si afterprint ne se déclenche pas
      setTimeout(cleanup, 60000)
    }, 400)
  }
  iframe.src = url
}
