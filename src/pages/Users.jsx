import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { formatDate } from '../lib/format'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/constants'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  roleId: '',
}

async function fetchUsers() {
  const { data, error } = await supabase
    .from('User')
    .select('*, roleRel:Role(id, name)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchRoles() {
  const { data, error } = await supabase.from('Role').select('*').order('name')
  if (error) throw error
  return data || []
}

export default function Users() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const { showAlert } = useAlert()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    onError: (err) => toast.error(err.message),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, roleId }) => {
      const { error } = await supabase.from('User').update({ roleId }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Rôle mis à jour')
    },
    onError: (err) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'create', ...payload },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Utilisateur créé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Utilisateur supprimé')
    },
    onError: (err) => toast.error(err.message),
  })

  const closeModal = () => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      showAlert('Tous les champs sont requis.')
      return
    }
    if (form.password.length < 6) {
      showAlert('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (!form.roleId) {
      showAlert('Veuillez sélectionner un rôle.')
      return
    }
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      roleId: form.roleId,
    })
  }

  const handleDelete = (member) => {
    if (member.id === currentUser.id) return
    if (!window.confirm(`Supprimer le compte de ${member.name} ?`)) return
    deleteMutation.mutate(member.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => setModalOpen(true)} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} />
          Créer un utilisateur
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
        {isLoading ? (
          <p className="p-6 text-text-secondary">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                  <th className="p-4 font-medium">Utilisateur</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Rôle</th>
                  <th className="p-4 font-medium">Créé le</th>
                  <th className="p-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((member) => (
                  <tr key={member.id} className="border-b border-c-border last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} bg={member.avatarBg} size="sm" />
                        <span className="font-medium text-text-primary">{member.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary">{member.email}</td>
                    <td className="p-4">
                      <select
                        value={member.roleId || ''}
                        onChange={(e) => roleMutation.mutate({ id: member.id, roleId: e.target.value })}
                        className={`${inputClass} w-auto py-1.5`}
                        style={{ color: ROLE_COLORS[member.roleRel?.name] }}
                      >
                        <option value="">— Sélectionner —</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-text-secondary">{formatDate(member.createdAt)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={member.id === currentUser.id || deleteMutation.isPending}
                        title={member.id === currentUser.id ? 'Impossible de supprimer son propre compte' : 'Supprimer'}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-c-danger disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Créer un utilisateur"
        footer={
          <>
            <button type="button" onClick={closeModal} className={btnSecondary}>
              Annuler
            </button>
            <button type="submit" form="user-form" disabled={createMutation.isPending} className={btnPrimary}>
              Créer
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nom complet</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>
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
            <label className={labelClass}>Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Rôle</label>
            <select
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Sélectionner un rôle —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}
