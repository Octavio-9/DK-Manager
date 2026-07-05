const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

// ── Structured generation (JSON) ─────────────────────────────────────────────

async function ask(prompt) {
  if (!API_KEY) throw new Error('NO_KEY')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erreur IA ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse vide du modèle')
  return JSON.parse(text)
}

// ── Conversational chat (free text, multi-turn) ───────────────────────────────

export async function chat({ messages, systemPrompt }) {
  if (!API_KEY) throw new Error('NO_KEY')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.85,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erreur IA ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse vide du modèle')
  return text
}

// System prompts par onglet — les paramètres du formulaire sont injectés côté UI
export const CHAT_SYSTEM_PROMPTS = {
  ideas: (ctx) => `Tu es un expert en stratégie de contenu pour une agence de production vidéo/photo francophone.
Tu aides à générer des idées créatives, des concepts de publications et des stratégies de contenu.
Réponds toujours en français, de manière concise et actionnée.${ctx}`,

  titles: (ctx) => `Tu es un expert en copywriting vidéo et en création de titres accrocheurs pour YouTube, TikTok et Reels.
Tu maîtrises les techniques de clickbait éthique, les formules de titres viraux et l'optimisation SEO vidéo.
Réponds toujours en français, propose des exemples concrets.${ctx}`,

  script: (ctx) => `Tu es un expert en production de vidéos courtes (Shorts, Reels, TikTok).
Tu maîtrises la structure narrative, les hooks d'accroche, le rythme du montage et les scripts percutants.
Réponds toujours en français, structure tes réponses clairement.${ctx}`,

  podcast: (ctx) => `Tu es un expert en podcasting, stratégie audio et création de contenu sonore francophone.
Tu maîtrises la structure d'épisodes, le storytelling audio, la promotion sur les réseaux et le SEO podcast.
Réponds toujours en français, sois pratique et orienté résultats.${ctx}`,
}

// ── Key check ─────────────────────────────────────────────────────────────────

export function hasKey() {
  return Boolean(API_KEY)
}

// ── Structured generators ─────────────────────────────────────────────────────

export async function generateIdeas({ subject, platform, tone, clientName }) {
  const result = await ask(`
Tu es expert en stratégie de contenu pour une agence de production vidéo/photo francophone.
Génère exactement 5 idées de contenu originales pour la plateforme ${platform} sur le sujet: "${subject}".
Ton de marque: ${tone}${clientName ? `. Client: ${clientName}` : ''}.

Pour chaque idée fournis:
- title: titre court accrocheur
- hook: première phrase d'accroche avec émoji
- caption: texte complet de la publication (émojis, CTA, hashtags)
- visual: description du plan vidéo recommandé (cadrage, lumière, montage)
- platform: "${platform}"

Réponds UNIQUEMENT avec un objet JSON valide contenant une clé "ideas" avec un tableau de 5 éléments. Sans markdown ni backticks.
`)
  return Array.isArray(result) ? result : (result.ideas || result)
}

export async function generateTitles({ subject, style }) {
  const result = await ask(`
Tu es un expert en copywriting vidéo (YouTube, TikTok, Reels).
Génère 10 titres ultra-accrocheurs sur le sujet: "${subject}". Style prioritaire: ${style}.
Chaque titre doit adopter un style différent et percutant.

Pour chaque titre:
- type: style du titre (ex: "Clickbait / Sensationnel", "Question / Engagement", "Éducatif / Valeur", etc.)
- text: le titre complet

Réponds UNIQUEMENT avec un objet JSON valide contenant une clé "titles" avec un tableau de 10 éléments. Sans markdown ni backticks.
`)
  return Array.isArray(result) ? result : (result.titles || result)
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

Réponds avec un objet JSON valide: {"title":"...","duration":"${duration}","sections":[...]}. Sans markdown ni backticks.
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
