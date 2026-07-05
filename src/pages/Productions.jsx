import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Film, Search, Upload, Link2, CheckCircle2, XCircle, Clock, Copy,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../context/AlertContext'
import { formatDate } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Constants ──────────────────────────────────────────────────── */

const PRODUCTION_TYPES = ['Podcast', 'Photo', 'Vidéo', 'Shooting', 'Autre']

const PRODUCTION_STATUS = {
  PLANNED:  { label: 'Planifié',   color: '#22d3ee' },
  RECORDED: { label: 'Enregistré', color: '#f59e0b' },
  EDITING:  { label: 'En montage', color: '#9d3bf1' },
  READY:    { label: 'Prêt',       color: '#10b981' },
}

const VALIDATION_STATUS = {
  PENDING:           { label: 'En attente',   color: '#f59e0b', Icon: Clock },
  APPROVED:          { label: 'Approuvé',     color: '#10b981', Icon: CheckCircle2 },
  CHANGES_REQUESTED: { label: 'Corrections',  color: '#ef4444', Icon: XCircle },
}

const EMPTY_FORM = {
  title: '',
  type: 'Vidéo',
  status: 'PLANNED',
  projectId: '',
  recordingDate: '',
  location: '',
}

/* ── Fetch helpers ──────────────────────────────────────────────── */

async function fetchProductions() {
  const { data, error } = await supabase
    .from('Production')
    .select('*, projectRel:Project(id, name, clientRel:Client(id, name)), files:ProductionFile(*)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name').order('name')
  if (error) throw error
  return data || []
}

/* ── Token generator ────────────────────────────────────────────── */

function generateToken() {
  return [...Array(32)].map(() => Math.random().toString(36)[2]).join('')
}

/* ── Production Card ─────────────────────────────────────────────── */

function ProductionCard({ prod, onEdit, onCopyValidationLink }) {
  const st = PRODUCTION_STATUS[prod.status] || { label: prod.status, color: '#6e6a75' }
  const vs = VALIDATION_STATUS[prod.validationStatus] || null
  const ValidIcon = vs?.Icon

  return (
    <div
      onClick={() => onEdit(prod)}
      className="cursor-pointer rounded-xl border border-c-border bg-bg-card p-4 transition-colors hover:border-accent-purple/50"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Film size={16} className="shrink-0 text-text-muted" />
          <p className="font-medium text-text-primary text-sm truncate">{prod.title}</p>
        </div>
        <Badge color={st.color}>{st.label}</Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-muted mb-2">
        <span className="rounded bg-bg-hover px-2 py-0.5">{prod.type}</span>
        {prod.recordingDate && <span>📅 {formatDate(prod.recordingDate)}</span>}
        {prod.location && <span>📍 {prod.location}</span>}
      </div>
      {prod.projectRel && (
        <p className="text-xs text-text-muted mb-2">
          📁 {prod.projectRel.name}
          {prod.projectRel.clientRel && <> · {prod.projectRel.clientRel.name}</>}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-text-muted">{prod.files?.length || 0} fichier{prod.files?.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {vs && (
            <span className="flex items-center gap-1 text-xs" style={{ color: vs.color }}>
              <ValidIcon size={11} /> {vs.label}
            </span>
          )}
          {prod.validationToken ? (
            <button
              onClick={() => onCopyValidationLink(prod.validationToken)}
              className="flex items-center gap-1 rounded-lg border border-c-border px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
            >
              <Copy size={11} /> Copier lien
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(prod, true) }}
              className="flex items-center gap-1 rounded-lg border border-dashed border-accent-purple/40 px-2 py-1 text-xs text-accent-purple hover:bg-accent-purple/10"
            >
              <Link2 size={11} /> Envoyer au client
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function Productions() {
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProd, setEditingProd] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [generateLink, setGenerateLink] = useState(false)

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: fetchProductions,
    onError: (e) => toast.error(e.message),
  })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const filtered = useMemo(() => {
    return productions.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return p.title.toLowerCase().includes(q) ||
          (p.projectRel?.name || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [productions, statusFilter, typeFilter, search])

  /* Mutations */
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingProd) {
        const { error } = await supabase.from('Production').update(payload).eq('id', editingProd.id)
        if (error) throw error
        return editingProd.id
      } else {
        const { data, error } = await supabase.from('Production').insert(payload).select('id').single()
        if (error) throw error
        return data.id
      }
    },
    onSuccess: async (prodId) => {
      // Upload file if pending
      if (pendingFile) {
        setUploadingFile(true)
        const path = `productions/${prodId}/${Date.now()}_${pendingFile.name.replace(/\s+/g, '_')}`
        const { error: upErr } = await supabase.storage.from('productions').upload(path, pendingFile)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('productions').getPublicUrl(path)
          await supabase.from('ProductionFile').insert({
            productionId: prodId,
            name: pendingFile.name,
            url: urlData.publicUrl,
            size: pendingFile.size,
            type: pendingFile.type,
          })
        }
        setUploadingFile(false)
        setPendingFile(null)
      }
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      toast.success(editingProd ? 'Production mise à jour' : 'Production créée')
      closeModal()
    },
    onError: (e) => { setUploadingFile(false); toast.error(e.message) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Production').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      toast.success('Production supprimée')
      closeModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const generateLinkMutation = useMutation({
    mutationFn: async (prodId) => {
      const token = generateToken()
      const { error } = await supabase.from('Production').update({ validationToken: token, validationStatus: 'PENDING' }).eq('id', prodId)
      if (error) throw error
      return token
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      const url = `${window.location.origin}/validate/${token}`
      navigator.clipboard.writeText(url).then(() => toast.success('Lien copié dans le presse-papiers !'))
    },
    onError: (e) => toast.error(e.message),
  })

  const copyLink = (token) => {
    const url = `${window.location.origin}/validate/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Lien copié !'))
  }

  const openCreate = () => {
    setEditingProd(null)
    setForm(EMPTY_FORM)
    setGenerateLink(false)
    setPendingFile(null)
    setModalOpen(true)
  }

  const openEdit = (prod, withLink = false) => {
    setEditingProd(prod)
    setForm({
      title: prod.title,
      type: prod.type,
      status: prod.status,
      projectId: prod.projectId || '',
      recordingDate: prod.recordingDate?.slice(0, 10) || '',
      location: prod.location || '',
    })
    setGenerateLink(withLink)
    setPendingFile(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProd(null)
    setForm(EMPTY_FORM)
    setGenerateLink(false)
    setPendingFile(null)
  }

  /* KPIs */
  const ready = productions.filter(p => p.status === 'READY').length
  const needsValidation = productions.filter(p => p.validationStatus === 'PENDING' && p.validationToken).length
  const approved = productions.filter(p => p.validationStatus === 'APPROVED').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total',            value: productions.length, color: '#9d3bf1' },
          { label: 'Prêts',            value: ready,              color: '#10b981' },
          { label: 'Attente validation', value: needsValidation,  color: '#f59e0b' },
          { label: 'Approuvés',        value: approved,           color: '#22d3ee' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-c-border bg-bg-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 sm:w-48`} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les statuts</option>
            {Object.entries(PRODUCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les types</option>
            {PRODUCTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className={`${btnPrimary} w-full sm:w-auto shrink-0`}>
          <Plus size={15} /> Nouvelle production
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Film size={40} className="text-text-muted/40" />
          <p className="text-text-secondary">Aucune production.</p>
          <button onClick={openCreate} className={btnPrimary}><Plus size={15} /> Créer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prod) => (
            <ProductionCard
              key={prod.id}
              prod={prod}
              onEdit={openEdit}
              onCopyValidationLink={copyLink}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProd ? 'Modifier la production' : 'Nouvelle production'}
        maxWidth="max-w-2xl"
        footer={
          <>
            {editingProd && (
              <button type="button" onClick={() => deleteMutation.mutate(editingProd.id)} disabled={deleteMutation.isPending} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="prod-global-form" disabled={saveMutation.isPending || uploadingFile} className={btnPrimary}>
              {uploadingFile ? 'Upload…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <form
          id="prod-global-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.title.trim()) { showAlert('Le titre est requis'); return }
            const payload = {
              title: form.title.trim(),
              type: form.type,
              status: form.status,
              projectId: form.projectId || null,
              recordingDate: form.recordingDate || null,
              location: form.location || null,
            }
            // If generating validation link, add token
            if (generateLink && !editingProd?.validationToken) {
              payload.validationToken = generateToken()
              payload.validationStatus = 'PENDING'
            }
            saveMutation.mutate(payload)
          }}
          className="space-y-4"
        >
          <div><label className={labelClass}>Titre *</label><input required className={inputClass} value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {PRODUCTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {Object.entries(PRODUCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projet associé</label>
              <select value={form.projectId} onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Date d&apos;enregistrement</label><input type="date" className={inputClass} value={form.recordingDate} onChange={(e) => setForm(f => ({ ...f, recordingDate: e.target.value }))} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Lieu</label><input className={inputClass} value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>

          {/* File upload */}
          <div>
            <label className={labelClass}>Ajouter un fichier (Supabase Storage)</label>
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-c-border p-5 text-sm text-text-muted transition-colors hover:border-accent-purple/50 hover:text-text-primary">
              <Upload size={18} />
              {pendingFile ? <span className="text-accent-purple font-medium">{pendingFile.name}</span> : <span>Cliquer pour sélectionner</span>}
              <input type="file" className="hidden" onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Existing files */}
          {editingProd?.files?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Fichiers existants ({editingProd.files.length})</p>
              <div className="space-y-1">
                {editingProd.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-xs text-text-secondary hover:text-text-primary">
                    📎 {f.name || f.url?.split('/').pop()}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Validation link section */}
          <div className="rounded-xl border border-c-border bg-bg-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Lien de validation client</p>
                <p className="text-xs text-text-muted mt-0.5">Permet au client d&apos;approuver ou demander des modifications</p>
              </div>
              {editingProd?.validationToken ? (
                <button
                  type="button"
                  onClick={() => copyLink(editingProd.validationToken)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple hover:bg-accent-purple/20"
                >
                  <Copy size={12} /> Copier le lien
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (editingProd) {
                      generateLinkMutation.mutate(editingProd.id)
                    } else {
                      setGenerateLink(!generateLink)
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    generateLink
                      ? 'bg-accent-purple text-white'
                      : 'border border-c-border text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <Link2 size={12} />
                  {generateLink ? 'Lien inclus ✓' : 'Générer un lien'}
                </button>
              )}
            </div>
            {editingProd?.validationStatus && (
              <div className="mt-3 flex items-center gap-2">
                {(() => {
                  const vs = VALIDATION_STATUS[editingProd.validationStatus]
                  if (!vs) return null
                  const Icon = vs.Icon
                  return (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: vs.color }}>
                      <Icon size={13} /> {vs.label}
                    </span>
                  )
                })()}
                {editingProd.clientComment && (
                  <p className="text-xs text-text-muted italic">— &ldquo;{editingProd.clientComment}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
