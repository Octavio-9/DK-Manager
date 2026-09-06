import { useState } from 'react'

// Logo DK Production.
//   variant="dark"  → logo noir sur fond blanc (/DK.jpeg), pour les surfaces
//                     claires : aperçu de facture, PDF, impression.
//   variant="light" → logo noir sur pastille blanche (/dk-logo-badge.png), pour
//                     les surfaces sombres de l'application. On garde le noir et
//                     blanc de la marque, comme sur le favicon, plutôt que de
//                     l'aplatir en une silhouette blanche.
// Les deux fichiers sont générés depuis le logo source par
// `node generate-pwa-icons.cjs`. En cas d'image absente, repli sur un SVG.
const SOURCES = {
  dark: '/DK.jpeg',
  light: '/dk-logo-badge.png',
}

export default function DKLogo({ className = 'h-12 w-auto', variant = 'dark' }) {
  const [failed, setFailed] = useState(false)
  const ink = '#111111'

  if (!failed) {
    return (
      <img
        src={SOURCES[variant] || SOURCES.dark}
        alt="DK Production"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
      />
    )
  }

  // Repli vectoriel : sigle caméra « DK » + mot PRODUCTION.
  return (
    <svg
      viewBox="0 0 260 150"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="DK Production"
    >
      {variant === 'light' && <rect width="260" height="150" rx="14" fill="#ffffff" />}
      <circle cx="70" cy="42" r="26" fill={ink} />
      <circle cx="34" cy="52" r="18" fill={ink} />
      <rect x="18" y="62" width="72" height="60" rx="8" fill={ink} />
      <path d="M90 78 L90 118 L128 98 Z" fill={ink} />
      <text
        x="146"
        y="104"
        fontSize="60"
        fontWeight="800"
        fill={ink}
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      >
        DK
      </text>
      <text
        x="130"
        y="141"
        textAnchor="middle"
        fontSize="25"
        fontWeight="700"
        letterSpacing="6"
        fill={ink}
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      >
        PRODUCTION
      </text>
    </svg>
  )
}
