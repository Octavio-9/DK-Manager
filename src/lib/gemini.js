const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

async function ask(prompt) {
  if (!API_KEY) throw new Error('NO_KEY')

  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erreur Gemini ${res.status}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Réponse vide de Gemini')
  return JSON.parse(text)
}

export function hasKey() {
  return Boolean(API_KEY)
}

export async function generateIdeas({ subject, platform, tone, clientName }) {
  return ask(`
Tu es expert en stratégie de contenu pour une agence de production vidéo/photo francophone.
Génère exactement 5 idées de contenu originales pour la plateforme ${platform} sur le sujet: "${subject}".
Ton de marque: ${tone}${clientName ? `. Client: ${clientName}` : ''}.

Pour chaque idée fournis:
- title: titre court accrocheur
- hook: première phrase d'accroche avec émoji
- caption: texte complet de la publication (émojis, CTA, hashtags)
- visual: description du plan vidéo recommandé (cadrage, lumière, montage)
- platform: "${platform}"

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni backticks.
`)
}

export async function generateTitles({ subject, style }) {
  return ask(`
Tu es un expert en copywriting vidéo (YouTube, TikTok, Reels).
Génère 10 titres ultra-accrocheurs sur le sujet: "${subject}". Style prioritaire: ${style}.
Chaque titre doit adopter un style différent et percutant.

Pour chaque titre:
- type: style du titre (ex: "Clickbait / Sensationnel", "Question / Engagement", "Éducatif / Valeur", etc.)
- text: le titre complet

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni backticks.
`)
}

export async function generateScript({ subject, hookType, duration, platform }) {
  return ask(`
Tu es expert en production de vidéos courtes (Shorts/Reels/TikTok).
Génère un script de ${duration} pour ${platform} sur: "${subject}".
Type de hook: ${hookType}.

Le script comprend 4 sections:
1. Accroche (0:00-0:03)
2. Problème & Solution
3. Démonstration / Explication
4. Appel à l'action (CTA)

Pour chaque section:
- time: timing (ex: "0:00 - 0:03")
- label: nom de la section
- visual: description du plan vidéo (cadrage, lumière, mouvement)
- audio: texte exact à dire (entre guillemets, naturel et percutant)
- overlay: texte d'incrustation à l'écran (court, percutant, avec émojis)

Réponds UNIQUEMENT avec ce JSON (sans markdown): {"title":"...","duration":"${duration}","sections":[...]}
`)
}

export async function generatePodcast({ subject }) {
  return ask(`
Tu es expert en podcasting et stratégie de contenu audio francophone.
Génère le contenu éditorial pour un épisode de podcast sur: "${subject}".

Fournis:
- summary: résumé engageant de l'épisode (3-4 phrases dynamiques)
- suggestedTitles: tableau de 3 titres d'épisode avec émojis 🎙️
- chapters: tableau de 5 chapitres [{time: "00:00", title: "..."}]
- socialPost: post réseaux sociaux complet pour annoncer l'épisode (émojis, hashtags)

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni backticks.
`)
}
