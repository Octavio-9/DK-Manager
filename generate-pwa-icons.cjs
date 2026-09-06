/**
 * Génère tous les visuels de marque à partir du logo public/DK.jpeg.
 *
 * Icônes (favicon, PWA, Apple) : seul le monogramme « DK » est utilisé, le mot
 * PRODUCTION étant illisible en 16-32 px. Le monogramme est détecté
 * automatiquement : on rogne le blanc autour du logo, puis on coupe à la bande
 * vide qui sépare le sigle du mot. Le sigle occupe 66 % de la largeur de
 * l'icône : sa diagonale reste dans la zone de sécurité des icônes
 * « maskable » (cercle central de 80 %).
 *
 * Pastilles (dk-mark-badge, dk-logo-badge) : logo noir sur fond blanc arrondi,
 * transparent autour. C'est le rendu du favicon, décliné pour les surfaces
 * sombres de l'app (sidebar, login, tableau d'objectifs) : la marque y garde
 * son noir et blanc au lieu d'être aplatie en silhouette blanche.
 *
 * Usage : node generate-pwa-icons.cjs
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const PUBLIC = path.join(__dirname, 'public')
const SRC = path.join(PUBLIC, 'DK.jpeg')
const WHITE = { r: 255, g: 255, b: 255 }
const MARK_RATIO = 0.66 // largeur du sigle / largeur de l'icône

const PNG_ICONS = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
]

// Isole le monogramme DK (partie haute du logo, au-dessus du mot PRODUCTION).
async function extractMark(lockup) {
  const g = await sharp(lockup).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = g.info

  // Première ligne totalement blanche après le sigle = début de la séparation
  let gapStart = H
  for (let y = 0; y < H; y++) {
    let hasInk = false
    for (let x = 0; x < W; x++) if (g.data[y * W + x] < 128) { hasInk = true; break }
    if (!hasInk) { gapStart = y; break }
  }
  if (gapStart <= 0 || gapStart >= H) {
    throw new Error(`Séparation sigle/texte introuvable dans ${SRC}`)
  }

  // Coupe la partie haute puis re-rogne les marges latérales du sigle
  return sharp(lockup)
    .extract({ left: 0, top: 0, width: W, height: gapStart })
    .trim({ threshold: 25 })
    .toBuffer()
}

// Compose le sigle centré sur un carré blanc de la taille demandée.
async function renderIcon(mark, size) {
  const inner = await sharp(mark)
    .resize({ width: Math.round(size * MARK_RATIO), fit: 'inside' })
    .toBuffer()
  const m = await sharp(inner).metadata()
  return sharp({ create: { width: size, height: size, channels: 3, background: WHITE } })
    .composite([{
      input: inner,
      top: Math.round((size - m.height) / 2),
      left: Math.round((size - m.width) / 2),
    }])
    .png()
    .toBuffer()
}

// Pastille à coins arrondis : visuel noir sur fond blanc, transparent autour.
// C'est le rendu du favicon, décliné pour les surfaces sombres de l'app afin
// que le logo y garde son noir et blanc au lieu d'être aplati en blanc.
async function renderBadge(input, { pad = 0.11, radius = 0.18 } = {}) {
  const m = await sharp(input).metadata()
  const padX = Math.round(m.width * pad)
  const padY = Math.round(m.height * pad)
  const width = m.width + padX * 2
  const height = m.height + padY * 2
  const r = Math.round(Math.min(width, height) * radius)

  const tile = await sharp({ create: { width, height, channels: 3, background: WHITE } })
    .composite([{ input, top: padY, left: padX }])
    .png()
    .toBuffer()

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  )
  return sharp(tile)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
}

async function generate() {
  const lockup = await sharp(SRC).trim({ threshold: 25 }).toBuffer()
  const mark = await extractMark(lockup)
  const md = await sharp(mark).metadata()
  console.log(`Sigle DK isolé : ${md.width}x${md.height}`)

  for (const { name, size } of PNG_ICONS) {
    fs.writeFileSync(path.join(PUBLIC, name), await renderIcon(mark, size))
    console.log(`✓ ${name} (${size}x${size})`)
  }

  // favicon.svg : le sigle embarqué en PNG 256 px (index.html reste inchangé)
  const b64 = (await renderIcon(mark, 256)).toString('base64')
  fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>DK Production</title>
  <image href="data:image/png;base64,${b64}" width="256" height="256"/>
</svg>
`)
  console.log('✓ favicon.svg')

  // Pastilles noir sur blanc pour les fonds sombres de l'application : sidebar,
  // écrans de connexion, écran de chargement, tableau d'objectifs.
  // Affichées entre 32 et 56 px de haut : ces largeurs couvrent large (>3x).
  const markBadge = await sharp(mark).resize({ width: 480 }).toBuffer()
  fs.writeFileSync(path.join(PUBLIC, 'dk-mark-badge.png'), await renderBadge(markBadge))
  console.log('✓ dk-mark-badge.png (sigle noir sur pastille blanche)')
  const logoBadge = await sharp(lockup).resize({ width: 640 }).toBuffer()
  fs.writeFileSync(
    path.join(PUBLIC, 'dk-logo-badge.png'),
    await renderBadge(logoBadge, { pad: 0.07, radius: 0.09 })
  )
  console.log('✓ dk-logo-badge.png (logo complet noir sur pastille blanche)')

  console.log('Tous les visuels de marque ont été générés.')
}

generate().catch((err) => { console.error(err); process.exit(1) })
