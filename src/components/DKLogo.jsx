import { useState } from 'react'

// Logo DK Production.
// Utilise le fichier /DK.jpeg s'il est présent dans le dossier public,
// sinon se rabat sur une version SVG recréée (nette à toute taille).
export default function DKLogo({ className = 'h-12 w-auto' }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src="/DK.jpeg"
        alt="DK Production"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 260 150"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="DK Production"
    >
      {/* Bobines */}
      <circle cx="70" cy="42" r="26" fill="#111111" />
      <circle cx="34" cy="52" r="18" fill="#111111" />
      {/* Corps de la caméra */}
      <rect x="18" y="62" width="72" height="60" rx="8" fill="#111111" />
      {/* Objectif */}
      <path d="M90 78 L90 118 L128 98 Z" fill="#111111" />
      {/* Viseur (coin blanc) */}
      <path
        d="M32 96 L32 78 L52 78"
        stroke="#ffffff"
        strokeWidth="5"
        fill="none"
        strokeLinecap="square"
      />
      {/* Texte */}
      <text
        x="146"
        y="104"
        fontSize="60"
        fontWeight="800"
        fill="#111111"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      >
        D-K
      </text>
      <text
        x="130"
        y="141"
        textAnchor="middle"
        fontSize="25"
        fontWeight="700"
        letterSpacing="6"
        fill="#111111"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      >
        PRODUCTION
      </text>
    </svg>
  )
}
