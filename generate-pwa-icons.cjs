const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, 'public', 'favicon.svg')
const svgBuffer = fs.readFileSync(svgPath)

const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

async function generate() {
  for (const { name, size } of sizes) {
    const outPath = path.join(__dirname, 'public', name)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓ Generated ${name} (${size}x${size})`)
  }
  console.log('All PWA icons generated.')
}

generate().catch(console.error)
