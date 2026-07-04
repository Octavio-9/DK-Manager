import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, FolderOpen, Search, Download, Upload, Tag, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Constants ──────────────────────────────────────────────────── */

const DOC_TYPES = ['Contrat', 'Devis', 'Bon de commande', 'Rapport', 'Facture', 'Autre']

const DOC_TYPE_COLORS = {
  Contrat:          '#9d3bf1',
  Devis:            '#22d3ee',
  'Bon de commande': '#f59e0b',
  Rapport:          '#10b981',
  Facture:          '#ef4444',
  Autre:            '#6e6a75',
}

const EMPTY_FORM = {
  title: '',
  type: 'Contrat',
  clientId: '',
  projectId: '',
  tags: '',
  notes: '',
  url: '',
  file: null,
}

/* ── Fetch helpers ──────────────────────────────────────────────── */

async function fetchDocuments() {
  const { data, error } = await supabase
    .from('Document')
    .select('*, clientRel:Client(id, name), projectRel:Project(id, name)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchClients() {
  const { data, error } = await supabase.from('Client').select('id, name').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name').order('name')
  if (error) throw error
  return data || []
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function Documents() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
    onError: (err) => toast.error(err.message),
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (typeFilter !== 'ALL' && d.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return d.title.toLowerCase().includes(q) ||
          (d.clientRel?.name || '').toLowerCase().includes(q) ||
          (d.projectRel?.name || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [documents, typeFilter, search])

  /* Mutations */
  const saveMutation = useMutation({
    mutationFn: async ({ formData, docId }) => {
      let fileUrl = formData.url || null

      // Handle Supabase Storage upload
      if (formData.file) {
        setUploading(true)
        const ext = formData.file.name.split('.').pop()
        const path = `documents/${Date.now()}_${formData.file.name.replace(/\s+/g, '_')}`
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(path, formData.file, { upsert: false })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        fileUrl = urlData.publicUrl
        setUploading(false)
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      const payload = {
        title: formData.title.trim(),
        type: formData.type,
        clientId: formData.clientId || null,
        projectId: formData.projectId || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: formData.notes || null,
        url: fileUrl || null,
        uploadedBy: authUser?.id || null,
      }

      if (docId) {
        const { error } = await supabase.from('Document').update(payload).eq('id', docId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Document').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success(editingDoc ? 'Document mis à jour' : 'Document ajouté')
      closeModal()
    },
    onError: (err) => { setUploading(false); toast.error(err.message) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Document').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document supprimé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  /* Helpers */
  const openCreateModal = () => {
    setEditingDoc(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (doc) => {
    setEditingDoc(doc)
    setForm({
      title: doc.title,
      type: doc.type,
      clientId: doc.clientId || '',
      projectId: doc.projectId || '',
      tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : '',
      notes: doc.notes || '',
      url: doc.url || '',
      file: null,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingDoc(null)
    setForm(EMPTY_FORM)
  }

  const getFileIcon = (url) => {
    if (!url) return '📄'
    const ext = url.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️'
    if (ext === 'pdf') return '📕'
    if (['doc', 'docx'].includes(ext)) return '📝'
    if (['xls', 'xlsx'].includes(ext)) return '📊'
    return '📎'
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {DOC_TYPES.slice(0, 4).map((t) => {
          const count = documents.filter((d) => d.type === t).length
          return (
            <div key={t} className="rounded-xl border border-c-border bg-bg-card p-4">
              <p className="text-xs text-text-muted">{t}s</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: DOC_TYPE_COLORS[t] }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 sm:w-52`}
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les types</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={openCreateModal} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} /> Ajouter un document
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FolderOpen size={40} className="text-text-muted/40" />
          <p className="text-text-secondary">Aucun document.</p>
          <button onClick={openCreateModal} className={btnPrimary}><Plus size={15} /> Ajouter</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              onClick={() => openEditModal(doc)}
              className="cursor-pointer rounded-xl border border-c-border bg-bg-card p-4 transition-colors hover:border-accent-purple/50"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="text-2xl">{getFileIcon(doc.url)}</span>
                <Badge color={DOC_TYPE_COLORS[doc.type] || '#6e6a75'}>{doc.type}</Badge>
              </div>
              <h3 className="mb-1 font-medium text-text-primary text-sm line-clamp-2">{doc.title}</h3>
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                {doc.clientRel && <p>👤 {doc.clientRel.name}</p>}
                {doc.projectRel && <p>📁 {doc.projectRel.name}</p>}
                <p>{formatDate(doc.createdAt)}</p>
              </div>
              {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-0.5 rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">
                      <Tag size={10} /> {tag}
                    </span>
                  ))}
                </div>
              )}
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 flex items-center gap-1.5 text-xs text-accent-purple hover:underline"
                >
                  <Eye size={12} /> Voir le fichier
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingDoc ? 'Modifier le document' : 'Ajouter un document'}
        maxWidth="max-w-2xl"
        footer={
          <>
            {editingDoc && (
              <button type="button" onClick={() => deleteMutation.mutate(editingDoc.id)} disabled={deleteMutation.isPending} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="doc-form" disabled={saveMutation.isPending || uploading} className={btnPrimary}>
              {uploading ? 'Envoi…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <form
          id="doc-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.title.trim()) { toast.error('Le titre est requis'); return }
            saveMutation.mutate({ formData: form, docId: editingDoc?.id || null })
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Titre *</label>
            <input required className={inputClass} value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Client</label>
              <select value={form.clientId} onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projet</label>
              <select value={form.projectId} onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tags (séparés par des virgules)</label>
              <input
                className={inputClass}
                placeholder="contrat, 2024, client-x…"
                value={form.tags}
                onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className={labelClass}>Fichier (Supabase Storage)</label>
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-c-border p-6 text-sm text-text-muted transition-colors hover:border-accent-purple/50 hover:text-text-primary">
              <Upload size={20} />
              {form.file ? (
                <span className="text-accent-purple font-medium">{form.file.name}</span>
              ) : (
                <span>Cliquer pour sélectionner un fichier</span>
              )}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setForm(f => ({ ...f, file: e.target.files?.[0] || null, url: '' }))}
              />
            </label>
            {editingDoc?.url && !form.file && (
              <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                <Download size={11} />
                Fichier existant :
                <a href={editingDoc.url} target="_blank" rel="noopener noreferrer" className="text-accent-purple hover:underline ml-1 truncate max-w-[200px]">
                  {editingDoc.url.split('/').pop()}
                </a>
              </p>
            )}
          </div>

          {/* OR external URL */}
          <div>
            <label className={labelClass}>Ou lien externe (URL)</label>
            <input
              type="url"
              className={inputClass}
              placeholder="https://drive.google.com/…"
              value={form.url}
              onChange={(e) => setForm(f => ({ ...f, url: e.target.value, file: null }))}
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
