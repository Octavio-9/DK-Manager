import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
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
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'
import Modal from '../components/ui/Modal'
import {
  hasKey,
  generateIdeas,
  generateTitles,
  generateScript,
  generatePodcast,
} from '../lib/gemini'

/* ── Fetch Client & Project lists ───────────────────────────────── */
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


export default function AiContent() {
  const [activeTab, setActiveTab] = useState('ideas') // 'ideas' | 'titles' | 'script' | 'podcast'
  const [subject, setSubject] = useState('')
  const [tone, setTone] = useState('Dynamique')
  const [style, setStyle] = useState('Intriguant')
  const [platform, setPlatform] = useState('Instagram')
  const [hookType, setHookType] = useState('Provocateur')
  const [duration, setDuration] = useState('30s')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // Scheduling integration modal
  const [planningModalOpen, setPlanningModalOpen] = useState(false)
  const [planForm, setPlanForm] = useState({
    platform: 'Instagram',
    content: '',
    scheduledAt: '',
    clientId: '',
    projectId: '',
    notes: '',
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects
    return projects.filter((p) => p.clientId === clientId)
  }, [projects, clientId])

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])
  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

  const handleGenerate = async () => {
    if (!subject.trim()) {
      toast.error('Veuillez saisir un sujet ou une thématique.')
      return
    }
    if (!hasKey()) {
      toast.error('Clé API Gemini manquante — configurez VITE_GEMINI_API_KEY.')
      return
    }

    setGenerating(true)
    setResults(null)

    try {
      const clientName = selectedClient?.name || selectedClient?.company_name
      let generated

      if (activeTab === 'ideas') {
        generated = await generateIdeas({ subject, platform, tone, clientName })
      } else if (activeTab === 'titles') {
        generated = await generateTitles({ subject, style })
      } else if (activeTab === 'script') {
        generated = await generateScript({ subject, hookType, duration, platform })
      } else {
        generated = await generatePodcast({ subject })
      }

      setResults(generated)
      toast.success('Contenu généré par Gemini IA !')
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

  // Open planning modal
  const openPlanning = (content, customPlatform = null) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const isoString = tomorrow.toISOString().slice(0, 16)

    setPlanForm({
      content,
      platform: customPlatform || platform || 'Instagram',
      scheduledAt: isoString,
      clientId: clientId || '',
      projectId: projectId || '',
      notes: 'Généré via l\'assistant IA',
    })
    setPlanningModalOpen(true)
  }

  // Save social post mutation
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
          Générez des idées, écrivez des scripts de Shorts ou créez des titres percutants en quelques secondes.
        </p>
      </div>

      {/* API key missing banner */}
      {!hasKey() && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Clé API Gemini non configurée</p>
            <p>
              Obtenez une clé gratuite sur{' '}
              <span className="font-mono text-amber-100">aistudio.google.com</span> puis ajoutez{' '}
              <span className="font-mono bg-amber-900/40 px-1 rounded">VITE_GEMINI_API_KEY=votre_clé</span>{' '}
              dans votre fichier <span className="font-mono">.env</span> (et dans les variables d'environnement Netlify).
            </p>
          </div>
        </div>
      )}

      {/* Tabs Nav */}
      <div className="flex flex-wrap border-b border-c-border">
        {[
          { id: 'ideas', label: 'Idées de contenu', icon: Lightbulb },
          { id: 'titles', label: 'Titres accrocheurs', icon: Heading },
          { id: 'script', label: 'Script de Short/Réel', icon: Film },
          { id: 'podcast', label: 'Analyseur Podcast', icon: Mic },
        ].map((tab) => {
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
                  ? 'border-accent-purple text-accent-purple'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form: Parameters */}
        <div className={`${cardClass} lg:col-span-5 h-fit`}>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">Paramètres de l'IA</h3>

          <div className="space-y-4">
            {/* Context mapping */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Client contextuel</label>
                <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId('') }} className={inputClass}>
                  <option value="">— Aucun (Générique) —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.industry ? `(${c.industry})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Projet associé</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass} disabled={!clientId}>
                  <option value="">— Aucun projet —</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                {activeTab === 'podcast' ? 'Titre de l\'épisode & Invité' : 'Sujet ou mot-clé principal *'}
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
                className={inputClass}
              />
            </div>

            {/* Tab specific inputs */}
            {activeTab === 'ideas' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Plateforme cible</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Facebook">Facebook</option>
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
                <textarea
                  rows={3}
                  className={inputClass}
                  placeholder="Points abordés, punchlines clés, moments drôles de l'enregistrement..."
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`${btnPrimary} w-full mt-2 flex items-center justify-center gap-2`}
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Générer avec l'IA
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Results */}
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
              {/* Output Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Suggestions IA</span>
                <span className="text-[10px] text-accent-cyan font-mono bg-accent-cyan/15 rounded-full px-2 py-0.5">
                  Température : Creative
                </span>
              </div>

              {/* Ideas Output */}
              {activeTab === 'ideas' && Array.isArray(results) && (
                <div className="space-y-4">
                  {results.map((idea, i) => (
                    <div key={i} className="group relative rounded-xl border border-c-border bg-bg-card p-4 transition-all hover:border-accent-purple/40 hover:shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent-purple">{idea.title}</span>
                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(`${idea.hook}\n\n${idea.caption}`, `idea-${i}`)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                            title="Copier"
                          >
                            {copiedId === `idea-${i}` ? <Check size={14} className="text-c-success" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={() => openPlanning(`${idea.hook}\n\n${idea.caption}`, idea.platform)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                            title="Planifier"
                          >
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

              {/* Titles Output */}
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
                          <button
                            onClick={() => handleCopy(title.text, `title-${i}`)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                            title="Copier"
                          >
                            {copiedId === `title-${i}` ? <Check size={13} className="text-c-success" /> : <Copy size={13} />}
                          </button>
                          <button
                            onClick={() => openPlanning(title.text)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                            title="Planifier dans l'agenda"
                          >
                            <CalendarPlus size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script Output */}
              {activeTab === 'script' && results && !Array.isArray(results) && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-c-border bg-bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-text-primary">{results.title}</h4>
                      <button
                        onClick={() => {
                          const fullScript = results.sections
                            .map((s) => `[${s.time}] - ${s.label}\nVisuel: ${s.visual}\nAudio: ${s.audio}\nTexte: ${s.overlay}`)
                            .join('\n\n')
                          handleCopy(fullScript, 'script-full')
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
                </div>
              )}

              {/* Podcast Output */}
              {activeTab === 'podcast' && results && !Array.isArray(results) && (
                <div className="space-y-4">
                  {/* Summary & Chapters */}
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

                  {/* Social Post Proposal */}
                  <div className="rounded-xl border border-c-border bg-bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Post Réseaux Sociaux Proposé</h4>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(results.socialPost, 'pod-social')}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                        >
                          {copiedId === 'pod-social' ? <Check size={14} className="text-c-success" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => openPlanning(results.socialPost)}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                        >
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

      {/* Integration Modal: Plan post */}
      <Modal
        open={planningModalOpen}
        onClose={() => setPlanningModalOpen(false)}
        title="Planifier dans le calendrier éditorial"
        maxWidth="max-w-xl"
        footer={
          <>
            <button onClick={() => setPlanningModalOpen(false)} className={btnSecondary}>
              Annuler
            </button>
            <button
              onClick={() => {
                if (!planForm.content.trim()) {
                  toast.error('Le contenu du post ne peut pas être vide.')
                  return
                }
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
              <select
                value={planForm.platform}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, platform: e.target.value }))}
                className={inputClass}
              >
                <option value="Instagram">Instagram</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
                <option value="Facebook">Facebook</option>
                <option value="Twitter">Twitter</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Date et heure planifiée</label>
              <input
                type="datetime-local"
                value={planForm.scheduledAt}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
              <select
                value={planForm.clientId}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, clientId: e.target.value, projectId: '' }))}
                className={inputClass}
              >
                <option value="">— Aucun client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Projet</label>
              <select
                value={planForm.projectId}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, projectId: e.target.value }))}
                className={inputClass}
              >
                <option value="">— Aucun projet —</option>
                {(planForm.clientId
                  ? projects.filter((p) => p.clientId === planForm.clientId)
                  : projects
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Contenu textuel (sera publié)</label>
            <textarea
              rows={5}
              value={planForm.content}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, content: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Notes internes</label>
            <textarea
              rows={2}
              value={planForm.notes}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, notes: e.target.value }))}
              className={inputClass}
              placeholder="Instructions pour le CM, idées de hashtags supplémentaires, etc."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
