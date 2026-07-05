import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Search, Mail, Phone, MapPin, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../context/AlertContext'
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPE_OPTIONS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_COLORS,
  CLIENT_STATUS_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

const EMPTY_FORM = {
  name: '',
  type: 'PARTICULIER',
  status: 'PROSPECT',
  email: '',
  phone: '',
  address: '',
  notes: '',
}

async function fetchClients() {
  const { data, error } = await supabase
    .from('Client')
    .select('*, projectCount:Project(count)')
    .order('name')
  if (error) throw error
  return (data || []).map((c) => ({ ...c, projectCount: c.projectCount?.[0]?.count || 0 }))
}

export default function Clients() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    onError: (err) => toast.error(err.message),
  })

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [clients, typeFilter, statusFilter, search])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingClient) {
        const { error } = await supabase.from('Client').update(payload).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Client').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients-list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editingClient ? 'Client mis à jour' : 'Client créé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Client').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients-list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Client supprimé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreateModal = () => {
    setEditingClient(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (client) => {
    setEditingClient(client)
    setForm({
      name: client.name || '',
      type: client.type || 'PARTICULIER',
      status: client.status || 'PROSPECT',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      notes: client.notes || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingClient(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showAlert('Le nom du client est requis.')
      return
    }
    saveMutation.mutate({
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 sm:w-56`}
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les types</option>
            {CLIENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {CLIENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les statuts</option>
            {CLIENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {CLIENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button onClick={openCreateModal} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      {isLoading ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-text-secondary">Aucun client ne correspond aux filtres.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="cursor-pointer rounded-xl border border-c-border bg-bg-card p-5 transition-colors hover:border-accent-purple/50"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-text-primary">{client.name}</h3>
                <Badge color={CLIENT_STATUS_COLORS[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
              </div>
              <div className="mb-3">
                <Badge color="#6e6a75">{CLIENT_TYPE_LABELS[client.type]}</Badge>
              </div>
              <div className="space-y-1.5 text-sm text-text-secondary">
                {client.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={14} className="text-text-muted" /> {client.email}
                  </p>
                )}
                {client.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={14} className="text-text-muted" /> {client.phone}
                  </p>
                )}
                {client.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-text-muted" /> {client.address}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5 border-t border-c-border pt-3 text-xs text-text-muted">
                <FolderKanban size={14} />
                {client.projectCount} projet{client.projectCount > 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        footer={
          <>
            {editingClient && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(editingClient.id)}
                disabled={deleteMutation.isPending}
                className={btnDanger}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeModal} className={btnSecondary}>
              Annuler
            </button>
            <button type="submit" form="client-form" disabled={saveMutation.isPending} className={btnPrimary}>
              Enregistrer
            </button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nom</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={inputClass}
              >
                {CLIENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {CLIENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={inputClass}
              >
                {CLIENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Téléphone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
