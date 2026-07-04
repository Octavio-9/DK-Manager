import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, User, Plus, Trash2,
  FolderKanban, FileText, Users, Pencil, Info,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatCurrency } from '../lib/format'
import {
  CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS, CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_LABELS, CLIENT_TYPE_OPTIONS,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Fetch helpers ─────────────────────────────────────────────── */

async function fetchClient(id) {
  const { data, error } = await supabase
    .from('Client')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

async function fetchClientContacts(clientId) {
  const { data, error } = await supabase
    .from('ClientContact')
    .select('*')
    .eq('clientId', clientId)
    .order('createdAt')
  if (error) throw error
  return data || []
}

async function fetchClientProjects(clientId) {
  const { data, error } = await supabase
    .from('Project')
    .select('*, typeRel:ProjectType(id, name, color)')
    .eq('clientId', clientId)
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

async function fetchClientInvoices(clientId) {
  const { data, error } = await supabase
    .from('Invoice')
    .select('*, items:InvoiceItem(*)')
    .eq('clientId', clientId)
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

/* ── Sub-components ─────────────────────────────────────────────── */

const TABS = [
  { key: 'info', label: 'Informations', icon: Info },
  { key: 'projects', label: 'Projets', icon: FolderKanban },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'invoices', label: 'Factures', icon: FileText },
]

const INVOICE_STATUS = {
  PENDING: { label: 'En attente', color: '#f59e0b' },
  PAID: { label: 'Payée', color: '#10b981' },
  OVERDUE: { label: 'En retard', color: '#ef4444' },
  CANCELLED: { label: 'Annulée', color: '#6e6a75' },
}

const EMPTY_CONTACT = { name: '', email: '', phone: '', position: '' }

/* ── Main Page ──────────────────────────────────────────────────── */

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('info')
  const [editOpen, setEditOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT)
  const [clientForm, setClientForm] = useState(null)

  /* Queries */
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    onSuccess: (d) => setClientForm({
      name: d.name || '',
      type: d.type || 'PARTICULIER',
      status: d.status || 'PROSPECT',
      email: d.email || '',
      phone: d.phone || '',
      address: d.address || '',
      notes: d.notes || '',
      companyName: d.companyName || '',
      contactName: d.contactName || '',
      industry: d.industry || '',
    }),
    onError: (err) => toast.error(err.message),
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts', id],
    queryFn: () => fetchClientContacts(id),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', id],
    queryFn: () => fetchClientProjects(id),
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', id],
    queryFn: () => fetchClientInvoices(id),
  })

  /* Save client mutation */
  const saveClientMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('Client').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client mis à jour')
      setEditOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  /* Contact mutations */
  const saveContactMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingContact) {
        const { error } = await supabase.from('ClientContact').update(payload).eq('id', editingContact.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ClientContact').insert({ ...payload, clientId: id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', id] })
      toast.success(editingContact ? 'Contact mis à jour' : 'Contact ajouté')
      setContactOpen(false)
      setEditingContact(null)
      setContactForm(EMPTY_CONTACT)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId) => {
      const { error } = await supabase.from('ClientContact').delete().eq('id', contactId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', id] })
      toast.success('Contact supprimé')
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-secondary">Chargement…</p>
  if (!client) return <p className="text-text-secondary">Client introuvable.</p>

  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, inv) => s + Number(inv.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{client.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={CLIENT_STATUS_COLORS[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
              <Badge color="#6e6a75">{CLIENT_TYPE_LABELS[client.type]}</Badge>
            </div>
          </div>
        </div>
        <button onClick={() => setEditOpen(true)} className={`${btnPrimary} w-full sm:w-auto`}>
          <Pencil size={16} />
          Modifier
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Projets', value: projects.length, color: '#9d3bf1' },
          { label: 'Contacts', value: contacts.length, color: '#22d3ee' },
          { label: 'Total facturé', value: formatCurrency(totalInvoiced), color: '#f59e0b' },
          { label: 'Total payé', value: formatCurrency(totalPaid), color: '#10b981' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-c-border bg-bg-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="mt-1 text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-c-border bg-bg-panel p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-accent-purple text-white'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-c-border bg-bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Coordonnées</h3>
            {client.companyName && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Building2 size={14} className="text-text-muted shrink-0" />
                {client.companyName}
              </div>
            )}
            {client.contactName && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <User size={14} className="text-text-muted shrink-0" />
                {client.contactName}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Mail size={14} className="text-text-muted shrink-0" />
                <a href={`mailto:${client.email}`} className="hover:text-accent-purple">{client.email}</a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Phone size={14} className="text-text-muted shrink-0" />
                {client.phone}
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <MapPin size={14} className="text-text-muted shrink-0" />
                {client.address}
              </div>
            )}
            {client.industry && (
              <div className="text-sm text-text-secondary">
                <span className="text-text-muted">Secteur : </span>{client.industry}
              </div>
            )}
          </div>
          {client.notes && (
            <div className="rounded-xl border border-c-border bg-bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Notes</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{projects.length} projet{projects.length !== 1 ? 's' : ''}</h3>
            <Link to="/projects" className={btnPrimary}>
              <Plus size={15} /> Nouveau projet
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun projet pour ce client.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <div key={p.id} className="rounded-xl border border-c-border bg-bg-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-text-primary text-sm">{p.name}</p>
                    <Badge color={PROJECT_STATUS_COLORS[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                  </div>
                  {p.typeRel && <Badge color={p.typeRel.color}>{p.typeRel.name}</Badge>}
                  <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                    <span>Budget : {formatCurrency(p.budget)}</span>
                    <span>{p.deadline ? formatDate(p.deadline) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</h3>
            <button
              onClick={() => { setEditingContact(null); setContactForm(EMPTY_CONTACT); setContactOpen(true) }}
              className={btnPrimary}
            >
              <Plus size={15} /> Ajouter un contact
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun contact associé.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-xl border border-c-border bg-bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary text-sm">{c.name}</p>
                      {c.position && <p className="text-xs text-text-muted">{c.position}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingContact(c); setContactForm({ name: c.name, email: c.email || '', phone: c.phone || '', position: c.position || '' }); setContactOpen(true) }}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteContactMutation.mutate(c.id)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-c-danger">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {c.email && <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Mail size={12} />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Phone size={12} />{c.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{invoices.length} facture{invoices.length !== 1 ? 's' : ''}</h3>
            <Link to="/invoices" className={btnPrimary}>
              <Plus size={15} /> Nouvelle facture
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune facture pour ce client.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                    <th className="p-4 font-medium">N° Facture</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Échéance</th>
                    <th className="p-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const s = INVOICE_STATUS[inv.status] || { label: inv.status, color: '#6e6a75' }
                    return (
                      <tr key={inv.id} className="border-b border-c-border last:border-0">
                        <td className="p-4 font-medium text-text-primary">{inv.invoiceNumber}</td>
                        <td className="p-4 text-text-secondary">{formatCurrency(inv.total)}</td>
                        <td className="p-4 text-text-secondary">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                        <td className="p-4"><Badge color={s.color}>{s.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Client Modal */}
      {clientForm && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier le client" maxWidth="max-w-2xl"
          footer={
            <>
              <button type="button" onClick={() => setEditOpen(false)} className={btnSecondary}>Annuler</button>
              <button type="submit" form="edit-client-form" disabled={saveClientMutation.isPending} className={btnPrimary}>Enregistrer</button>
            </>
          }
        >
          <form id="edit-client-form" onSubmit={(e) => { e.preventDefault(); saveClientMutation.mutate(clientForm) }} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Nom</label><input className={inputClass} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className={labelClass}>Nom entreprise</label><input className={inputClass} value={clientForm.companyName} onChange={e => setClientForm(f => ({ ...f, companyName: e.target.value }))} /></div>
              <div><label className={labelClass}>Contact principal</label><input className={inputClass} value={clientForm.contactName} onChange={e => setClientForm(f => ({ ...f, contactName: e.target.value }))} /></div>
              <div><label className={labelClass}>Secteur d&apos;activité</label><input className={inputClass} value={clientForm.industry} onChange={e => setClientForm(f => ({ ...f, industry: e.target.value }))} /></div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={clientForm.type} onChange={e => setClientForm(f => ({ ...f, type: e.target.value }))}>
                  {CLIENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Statut</label>
                <select className={inputClass} value={clientForm.status} onChange={e => setClientForm(f => ({ ...f, status: e.target.value }))}>
                  {CLIENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{CLIENT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className={labelClass}>Téléphone</label><input className={inputClass} value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><label className={labelClass}>Adresse</label><input className={inputClass} value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><label className={labelClass}>Notes</label><textarea rows={3} className={inputClass} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </form>
        </Modal>
      )}

      {/* Contact Modal */}
      <Modal open={contactOpen} onClose={() => { setContactOpen(false); setEditingContact(null); setContactForm(EMPTY_CONTACT) }}
        title={editingContact ? 'Modifier le contact' : 'Ajouter un contact'}
        footer={
          <>
            {editingContact && (
              <button type="button" onClick={() => { deleteContactMutation.mutate(editingContact.id); setContactOpen(false) }} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={() => setContactOpen(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="contact-form" disabled={saveContactMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form id="contact-form" onSubmit={(e) => { e.preventDefault(); saveContactMutation.mutate(contactForm) }} className="space-y-4">
          <div><label className={labelClass}>Nom *</label><input required className={inputClass} value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelClass}>Poste</label><input className={inputClass} value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className={labelClass}>Téléphone</label><input className={inputClass} value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
