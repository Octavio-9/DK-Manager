import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Wand2,
  Copy,
  CalendarPlus,
  Loader2,
  Check,
  Lightbulb,
  Heading,
  Film,
  Mic,
  KeyRound,
  MessageSquare,
  LayoutGrid,
  Send,
  Trash2,
  Bot,
  User,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'
import Modal from '../components/ui/Modal'
import {
  hasKey,
  chat,
  CHAT_SYSTEM_PROMPTS,
  generateIdeas,
  generateTitles,
  generateScript,
  generatePodcast,
} from '../lib/gemini'
import { useAlert } from '../context/AlertContext'

/* ── Constants ───────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'ideas',   label: 'Idées de contenu',    icon: Lightbulb, color: 'text-amber-400',   bg: 'bg-amber-400/15',   border: 'border-amber-400/30' },
  { id: 'titles',  label: 'Titres accrocheurs',   icon: Heading,   color: 'text-blue-400',    bg: 'bg-blue-400/15',    border: 'border-blue-400/30'  },
  { id: 'script',  label: 'Script Short/Réel',    icon: Film,      color: 'text-rose-400',    bg: 'bg-rose-400/15',    border: 'border-rose-400/30'  },
  { id: 'podcast', label: 'Analyseur Podcast',    icon: Mic,       color: 'text-emerald-400', bg: 'bg-emerald-400/15', border: 'border-emerald-400/30'},
]

/* ── Supabase helpers ────────────────────────────────────────────────────── */

async function fetchClients() {
  const { data, error } = await supabase.from('Client').select('id, name, company_name, industry').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name, clientId, description').order('name')
  if (error) throw error
  return data || []
}

async function fetchChatHistory() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('ChatMessage')
    .select('*')
    .eq('userId', user.id)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return data || []
}

async function saveChatMessage({ userId, tab, role, content }) {
  const { error } = await supabase.from('ChatMessage').insert({ userId, tab, role, content })
  if (error) throw error
}

async function clearChatHistory(userId) {
  const { error } = await supabase.from('ChatMessage').delete().eq('userId', userId)
  if (error) throw new Error(error.message || JSON.stringify(error))
}

/* ── Chat bubble component ───────────────────────────────────────────────── */

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  const tab = TABS.find((t) => t.id === message.tab)

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-accent-purple/20 text-accent-purple' : 'bg-bg-panel border border-c-border text-text-muted'
      }`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      <div className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Tab badge */}
        {tab && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${tab.bg} ${tab.color} ${tab.border} border`}>
            <tab.icon size={9} />
            {tab.label}
          </span>
        )}

        {/* Message bubble */}
        <div className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-accent-purple/20 text-text-primary'
            : 'rounded-tl-sm bg-bg-panel border border-c-border text-text-secondary'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-panel border border-c-border text-text-muted">
        <Bot size={13} />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-bg-panel border border-c-border px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce" />
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function AiContent() {
  /* Form state */
  const [activeTab, setActiveTab] = useState('ideas')
  const [subject, setSubject] = useState('')
  const [tone, setTone] = useState('Dynamique')
  const [style, setStyle] = useState('Intriguant')
  const [platform, setPlatform] = useState('Instagram')
  const [hookType, setHookType] = useState('Provocateur')
  const [duration, setDuration] = useState('30s')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')

  /* Generation state */
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  /* Chat state */
  const [chatMode, setChatMode] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [localMessages, setLocalMessages] = useState([]) // optimistic UI
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)

  /* Planning modal state */
  const [planningModalOpen, setPlanningModalOpen] = useState(false)
  const [planForm, setPlanForm] = useState({
    platform: 'Instagram', content: '', scheduledAt: '', clientId: '', projectId: '', notes: '',
  })

  const queryClient = useQueryClient()
  const { showAlert } = useAlert()

  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })
  const { data: chatHistory = [] } = useQuery({
    queryKey: ['chat-history'],
    queryFn: fetchChatHistory,
    enabled: chatMode,
  })

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects
    return projects.filter((p) => p.clientId === clientId)
  }, [projects, clientId])

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])

  /* Merge DB history + optimistic local messages */
  const allMessages = useMemo(() => {
    const ids = new Set(chatHistory.map((m) => m.id))
    return [
      ...chatHistory,
      ...localMessages.filter((m) => !ids.has(m.id)),
    ]
  }, [chatHistory, localMessages])

  /* Auto-scroll chat to bottom */
  useEffect(() => {
    if (chatMode) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [allMessages, typing, chatMode])

  /* Focus input when entering chat mode */
  useEffect(() => {
    if (chatMode) {
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }, [chatMode])

  /* Save message mutation */
  const saveMsg = useMutation({
    mutationFn: saveChatMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  })

  /* Clear history mutation */
  const clearHistory = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Vous devez être connecté.')
      await clearChatHistory(user.id)
    },
    onSuccess: () => {
      setLocalMessages([])
      queryClient.invalidateQueries({ queryKey: ['chat-history'] })
      toast.success('Conversation effacée.')
    },
    onError: (err) => toast.error(`Erreur : ${err.message}`),
  })

  /* Build system prompt with current form context injected silently */
  const buildSystemPrompt = () => {
    const ctxParts = []
    if (activeTab === 'ideas' || activeTab === 'script') ctxParts.push(`Plateforme : ${platform}`)
    if (activeTab === 'ideas') ctxParts.push(`Ton de marque : ${tone}`)
    if (activeTab === 'titles') ctxParts.push(`Style recherché : ${style}`)
    if (activeTab === 'script') ctxParts.push(`Type de hook : ${hookType}`, `Durée : ${duration}`)
    const clientName = selectedClient?.name || selectedClient?.company_name
    if (clientName) ctxParts.push(`Client : ${clientName}`)
    if (subject.trim()) ctxParts.push(`Sujet/contexte en cours : "${subject}"`)

    const ctx = ctxParts.length > 0
      ? `\n\nContexte actuel du projet : ${ctxParts.join(' | ')}.`
      : ''

    return CHAT_SYSTEM_PROMPTS[activeTab](ctx)
  }

  /* Send chat message */
  const handleSendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    if (!hasKey()) {
      toast.error('Clé API Groq manquante — configurez VITE_GROQ_API_KEY.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Vous devez être connecté pour utiliser le chat.')
      return
    }

    const userMsg = { id: `local-${Date.now()}`, tab: activeTab, role: 'user', content: text }
    setLocalMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setTyping(true)

    // Save user message to DB
    saveMsg.mutate({ userId: user.id, tab: activeTab, role: 'user', content: text })

    // Build history for API (DB + optimistic, text only)
    const history = [
      ...allMessages,
      { role: 'user', content: text },
    ].map((m) => ({ role: m.role, content: m.content }))

    try {
      const reply = await chat({ messages: history, systemPrompt: buildSystemPrompt() })
      const assistantMsg = { id: `local-${Date.now() + 1}`, tab: activeTab, role: 'assistant', content: reply }
      setLocalMessages((prev) => [...prev, assistantMsg])
      saveMsg.mutate({ userId: user.id, tab: activeTab, role: 'assistant', content: reply })
    } catch (err) {
      toast.error(`Erreur IA : ${err.message}`)
    } finally {
      setTyping(false)
    }
  }

  /* Generate structured content (existing flow) */
  const handleGenerate = async () => {
    if (!subject.trim()) {
      showAlert('Veuillez saisir un sujet ou une thématique.')
      return
    }
    if (!hasKey()) {
      toast.error('Clé API Groq manquante — configurez VITE_GROQ_API_KEY.')
      return
    }

    setGenerating(true)
    setResults(null)

    try {
      const clientName = selectedClient?.name || selectedClient?.company_name
      let generated

      if (activeTab === 'ideas')        generated = await generateIdeas({ subject, platform, tone, clientName })
      else if (activeTab === 'titles')  generated = await generateTitles({ subject, style })
      else if (activeTab === 'script')  generated = await generateScript({ subject, hookType, duration, platform })
      else                              generated = await generatePodcast({ subject })

      setResults(generated)
      toast.success('Contenu généré par Groq IA !')
    } catch (err) {
      toast.error(`Erreur IA : ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copié dans le presse-papiers !')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openPlanning = (content, customPlatform = null) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    setPlanForm({
      content,
      platform: customPlatform || platform || 'Instagram',
      scheduledAt: tomorrow.toISOString().slice(0, 16),
      clientId: clientId || '',
      projectId: projectId || '',
      notes: "Généré via l'assistant IA",
    })
    setPlanningModalOpen(true)
  }

  const savePostMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('SocialPost').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Post planifié dans le calendrier éditorial !')
      setPlanningModalOpen(false)
    },
    onError: (e) => toast.error(`Erreur : ${e.message}`),
  })

  const activeTabMeta = TABS.find((t) => t.id === activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/20 text-accent-purple">
            <Sparkles size={16} />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Assistant de Contenu IA</h2>
        </div>
        <p className="text-xs text-text-muted">
          Générez des idées, écrivez des scripts ou discutez librement avec l'IA en mode conversationnel.
        </p>
      </div>

      {/* API key missing banner */}
      {!hasKey() && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Clé API Groq non configurée</p>
            <p>
              Obtenez une clé gratuite sur{' '}
              <span className="font-mono text-amber-100">console.groq.com</span> puis ajoutez{' '}
              <span className="font-mono bg-amber-900/40 px-1 rounded">VITE_GROQ_API_KEY=votre_clé</span>{' '}
              dans votre fichier <span className="font-mono">.env</span> (et dans les variables d'environnement Netlify).
            </p>
          </div>
        </div>
      )}

      {/* Tabs Nav + Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border pb-0">
        <div className="flex flex-wrap">
          {TABS.map((tab) => {
            const TabIcon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setResults(null)
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-all ${
                  active
                    ? `border-accent-purple text-accent-purple`
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-c-border bg-bg-panel p-1 mb-0.5">
          <button
            onClick={() => setChatMode(false)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              !chatMode ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <LayoutGrid size={13} />
            Formulaire
          </button>
          <button
            onClick={() => setChatMode(true)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              chatMode ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <MessageSquare size={13} />
            Chat IA
          </button>
        </div>
      </div>

      {/* ── FORM MODE ── */}
      {!chatMode && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Parameters */}
          <div className={`${cardClass} lg:col-span-5 h-fit`}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">Paramètres de génération</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Client contextuel</label>
                  <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId('') }} className={inputClass}>
                    <option value="">— Aucun (Générique) —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.industry ? `(${c.industry})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Projet associé</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass} disabled={!clientId}>
                    <option value="">— Aucun projet —</option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {activeTab === 'podcast' ? "Titre de l'épisode & Invité" : 'Sujet ou mot-clé principal *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeTab === 'podcast'
                      ? 'Ex: Le futur du montage vidéo avec @JeanDupont'
                      : 'Ex: l\'importance de la régularité sur les réseaux sociaux'
                  }
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  className={inputClass}
                />
              </div>

              {activeTab === 'ideas' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Plateforme cible</label>
                    <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                      <option>Instagram</option><option>TikTok</option><option>YouTube</option>
                      <option>LinkedIn</option><option>Facebook</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Ton de la marque</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)} className={inputClass}>
                      <option value="Dynamique">Dynamique / Énergique</option>
                      <option value="Professionnel">Professionnel / Corporate</option>
                      <option value="Humoristique">Humoristique / Léger</option>
                      <option value="Inspirant">Inspirant / Motivation</option>
                      <option value="Éducatif">Éducatif / Informateur</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'titles' && (
                <div>
                  <label className={labelClass}>Style de titre recherché</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputClass}>
                    <option value="Intriguant">Intriguant / Mystérieux</option>
                    <option value="Clickbait">Clickbait intelligent</option>
                    <option value="Éducatif">Direct & Instructif</option>
                    <option value="Question">Question engageante</option>
                  </select>
                </div>
              )}

              {activeTab === 'script' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Format de départ (Hook)</label>
                    <select value={hookType} onChange={(e) => setHookType(e.target.value)} className={inputClass}>
                      <option value="Provocateur">Provocateur ("Arrêtez de faire ça...")</option>
                      <option value="Question">Question fermée ("Tu savais que...")</option>
                      <option value="Chiffré">Donnée chiffrée ("99% échouent car...")</option>
                      <option value="Storytelling">Récit personnel ("Comment j'ai...")</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Durée ciblée</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass}>
                      <option value="15s">Très court (15s)</option>
                      <option value="30s">Standard (30s)</option>
                      <option value="60s">Long / Détaillé (60s)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'podcast' && (
                <div>
                  <label className={labelClass}>Notes ou résumé succinct de l'épisode</label>
                  <textarea rows={3} className={inputClass} placeholder="Points abordés, punchlines clés, moments drôles de l'enregistrement..." />
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`${btnPrimary} w-full mt-2 flex items-center justify-center gap-2`}
              >
                {generating ? (
                  <><Loader2 size={16} className="animate-spin" />Génération en cours...</>
                ) : (
                  <><Wand2 size={16} />Générer avec l'IA</>
                )}
              </button>
            </div>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-7 space-y-4">
            {generating ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-c-border bg-bg-card p-8 text-center shadow-lg">
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-purple/10">
                  <Sparkles size={28} className="animate-pulse text-accent-purple" />
                </div>
                <h4 className="text-sm font-semibold text-text-primary animate-pulse">L'IA rédige votre contenu...</h4>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  Analyse de votre thématique et application des styles créatifs configurés.
                </p>
              </div>
            ) : results ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Suggestions IA</span>
                  <span className="text-[10px] text-accent-cyan font-mono bg-accent-cyan/15 rounded-full px-2 py-0.5">
                    Température : Creative
                  </span>
                </div>

                {/* Ideas */}
                {activeTab === 'ideas' && Array.isArray(results) && (
                  <div className="space-y-4">
                    {results.map((idea, i) => (
                      <div key={i} className="group relative rounded-xl border border-c-border bg-bg-card p-4 transition-all hover:border-accent-purple/40 hover:shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-accent-purple">{idea.title}</span>
                          <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCopy(`${idea.hook}\n\n${idea.caption}`, `idea-${i}`)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                              {copiedId === `idea-${i}` ? <Check size={14} className="text-c-success" /> : <Copy size={14} />}
                            </button>
                            <button onClick={() => openPlanning(`${idea.hook}\n\n${idea.caption}`, idea.platform)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                              <CalendarPlus size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs text-text-secondary">
                          <p><strong className="text-text-primary">Accroche :</strong> {idea.hook}</p>
                          <p className="whitespace-pre-line leading-relaxed"><strong className="text-text-primary">Texte de publication :</strong> {idea.caption}</p>
                          <p className="rounded bg-bg-panel p-2.5 text-text-muted italic">
                            💡 <strong className="text-text-primary">Visuel suggéré :</strong> {idea.visual}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Titles */}
                {activeTab === 'titles' && Array.isArray(results) && (
                  <div className="rounded-xl border border-c-border bg-bg-card overflow-hidden">
                    <div className="divide-y divide-c-border">
                      {results.map((title, i) => (
                        <div key={i} className="group flex items-center justify-between p-3.5 hover:bg-bg-hover/20">
                          <div className="min-w-0 pr-4">
                            <span className="text-[10px] font-semibold text-text-muted block">{title.type}</span>
                            <span className="text-xs text-text-primary font-medium block truncate mt-0.5">{title.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCopy(title.text, `title-${i}`)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                              {copiedId === `title-${i}` ? <Check size={13} className="text-c-success" /> : <Copy size={13} />}
                            </button>
                            <button onClick={() => openPlanning(title.text)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                              <CalendarPlus size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script */}
                {activeTab === 'script' && results && !Array.isArray(results) && (
                  <div className="rounded-xl border border-c-border bg-bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-text-primary">{results.title}</h4>
                      <button
                        onClick={() => {
                          const full = results.sections.map((s) => `[${s.time}] - ${s.label}\nVisuel: ${s.visual}\nAudio: ${s.audio}\nTexte: ${s.overlay}`).join('\n\n')
                          handleCopy(full, 'script-full')
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-c-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
                      >
                        {copiedId === 'script-full' ? <Check size={13} className="text-c-success" /> : <Copy size={13} />}
                        Copier script complet
                      </button>
                    </div>
                    <div className="space-y-3.5">
                      {results.sections.map((section, i) => (
                        <div key={i} className="border-l-2 border-accent-purple/35 pl-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-text-muted uppercase">{section.time} · {section.label}</span>
                            {section.overlay && (
                              <span className="text-[9px] font-mono bg-bg-panel border border-c-border text-accent-cyan rounded px-1.5 py-0.5">
                                Incrustation : {section.overlay}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary"><strong className="text-text-primary">Visuel :</strong> {section.visual}</p>
                          <p className="text-xs text-text-secondary font-medium"><strong className="text-text-primary">Audio :</strong> {section.audio}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Podcast */}
                {activeTab === 'podcast' && results && !Array.isArray(results) && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-c-border bg-bg-card p-4 space-y-3">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Résumé de l'épisode</h4>
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{results.summary}</p>
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mt-4">Sommaire & Timestamps</h4>
                      <div className="space-y-1">
                        {results.chapters.map((ch, i) => (
                          <div key={i} className="flex gap-3 text-xs p-1 rounded hover:bg-bg-hover/20">
                            <span className="font-mono text-accent-purple font-semibold shrink-0">{ch.time}</span>
                            <span className="text-text-secondary">{ch.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-c-border bg-bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Post Réseaux Sociaux Proposé</h4>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleCopy(results.socialPost, 'pod-social')} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                            {copiedId === 'pod-social' ? <Check size={14} className="text-c-success" /> : <Copy size={14} />}
                          </button>
                          <button onClick={() => openPlanning(results.socialPost)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                            <CalendarPlus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="rounded bg-bg-panel p-3 text-xs text-text-secondary font-mono whitespace-pre-line leading-relaxed">
                        {results.socialPost}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-c-border bg-bg-card/50 p-8 text-center">
                <Sparkles size={36} className="text-text-muted/30 mb-3" />
                <h4 className="text-sm font-semibold text-text-primary">Aucun contenu généré pour le moment</h4>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  Saisissez vos mots-clés dans le formulaire de gauche puis cliquez sur "Générer" pour obtenir des suggestions intelligentes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT MODE ── */}
      {chatMode && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Context panel (same form fields, read-only hint) */}
          <div className={`${cardClass} lg:col-span-4 h-fit`}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-text-muted">Contexte injecté</h3>
            <p className="mb-4 text-[10px] text-text-muted leading-relaxed">
              Ces paramètres sont transmis silencieusement à l'IA — elle connaît votre contexte sans que vous ayez à le répéter.
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Client</label>
                <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId('') }} className={inputClass}>
                  <option value="">— Aucun (Générique) —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Sujet / contexte</label>
                <input
                  type="text"
                  placeholder="Ex: régularité sur les réseaux sociaux"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClass}
                />
              </div>

              {(activeTab === 'ideas' || activeTab === 'script') && (
                <div>
                  <label className={labelClass}>Plateforme</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                    <option>Instagram</option><option>TikTok</option><option>YouTube</option>
                    <option>LinkedIn</option><option>Facebook</option>
                  </select>
                </div>
              )}

              {activeTab === 'ideas' && (
                <div>
                  <label className={labelClass}>Ton de marque</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className={inputClass}>
                    <option value="Dynamique">Dynamique / Énergique</option>
                    <option value="Professionnel">Professionnel / Corporate</option>
                    <option value="Humoristique">Humoristique / Léger</option>
                    <option value="Inspirant">Inspirant / Motivation</option>
                    <option value="Éducatif">Éducatif / Informateur</option>
                  </select>
                </div>
              )}

              {/* Current tab badge */}
              <div className="pt-2 border-t border-c-border">
                <p className="text-[10px] text-text-muted mb-2">Rôle IA actif</p>
                <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTabMeta.bg} ${activeTabMeta.color} ${activeTabMeta.border} border`}>
                  <activeTabMeta.icon size={13} />
                  {activeTabMeta.label}
                </div>
              </div>

              {/* Clear history button */}
              <button
                onClick={() => {
                  if (allMessages.length === 0) return
                  if (window.confirm('Effacer tout l\'historique de conversation ? Cette action est irréversible.')) {
                    clearHistory.mutate()
                  }
                }}
                disabled={clearHistory.isPending || allMessages.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {clearHistory.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Vider la conversation
              </button>
            </div>
          </div>

          {/* Right: Chat panel */}
          <div className="lg:col-span-8 flex flex-col" style={{ height: '70vh' }}>
            <div className="flex flex-col h-full rounded-xl border border-c-border bg-bg-card overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-c-border px-4 py-3 shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple">
                  <Bot size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Chat IA</p>
                  <p className="text-[10px] text-text-muted">Historique partagé entre tous les onglets · Privé par utilisateur</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-semibold">En ligne</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {allMessages.length === 0 && !typing && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare size={36} className="text-text-muted/20 mb-3" />
                    <p className="text-sm font-semibold text-text-primary">Démarrez la conversation</p>
                    <p className="text-xs text-text-muted mt-1 max-w-xs">
                      Posez une question sur votre contenu, demandez des idées, ou discutez de votre stratégie.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        'Donne-moi 3 idées de contenu pour cette semaine',
                        'Comment améliorer mon taux d\'engagement ?',
                        'Quel est le meilleur moment pour publier ?',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setChatInput(suggestion)}
                          className="rounded-lg border border-c-border bg-bg-panel px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:border-accent-purple/40 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {allMessages.map((msg, i) => (
                  <ChatBubble key={msg.id || i} message={msg} />
                ))}

                {typing && <TypingIndicator />}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-c-border px-4 py-3 shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={chatInputRef}
                    rows={1}
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendChat()
                      }
                    }}
                    placeholder="Écrivez un message... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
                    className="flex-1 resize-none rounded-xl border border-c-border bg-bg-panel px-3.5 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-purple/50 transition-colors"
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                    disabled={typing}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={typing || !chatInput.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-purple text-white transition-all hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {typing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-text-muted">
                  Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planning Modal */}
      <Modal
        open={planningModalOpen}
        onClose={() => setPlanningModalOpen(false)}
        title="Planifier dans le calendrier éditorial"
        maxWidth="max-w-xl"
        footer={
          <>
            <button onClick={() => setPlanningModalOpen(false)} className={btnSecondary}>Annuler</button>
            <button
              onClick={() => {
                if (!planForm.content.trim()) { toast.error('Le contenu du post ne peut pas être vide.'); return }
                savePostMutation.mutate({
                  platform: planForm.platform,
                  content: planForm.content.trim(),
                  scheduledAt: planForm.scheduledAt || null,
                  clientId: planForm.clientId || null,
                  projectId: planForm.projectId || null,
                  notes: planForm.notes || null,
                  status: 'SCHEDULED',
                })
              }}
              disabled={savePostMutation.isPending}
              className={btnPrimary}
            >
              {savePostMutation.isPending ? 'Planification...' : 'Confirmer la planification'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Plateforme de diffusion</label>
              <select value={planForm.platform} onChange={(e) => setPlanForm((p) => ({ ...p, platform: e.target.value }))} className={inputClass}>
                <option>Instagram</option><option>LinkedIn</option><option>TikTok</option>
                <option>YouTube</option><option>Facebook</option><option>Twitter</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date et heure planifiée</label>
              <input type="datetime-local" value={planForm.scheduledAt} onChange={(e) => setPlanForm((p) => ({ ...p, scheduledAt: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
              <select value={planForm.clientId} onChange={(e) => setPlanForm((p) => ({ ...p, clientId: e.target.value, projectId: '' }))} className={inputClass}>
                <option value="">— Aucun client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projet</label>
              <select value={planForm.projectId} onChange={(e) => setPlanForm((p) => ({ ...p, projectId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun projet —</option>
                {(planForm.clientId ? projects.filter((p) => p.clientId === planForm.clientId) : projects).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Contenu textuel (sera publié)</label>
            <textarea rows={5} value={planForm.content} onChange={(e) => setPlanForm((p) => ({ ...p, content: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes internes</label>
            <textarea rows={2} value={planForm.notes} onChange={(e) => setPlanForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Instructions pour le CM, idées de hashtags supplémentaires, etc." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
