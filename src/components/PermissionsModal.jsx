import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { PERMISSION_PAGES, CRUD_ACTIONS, effectiveMatrix, diffFromRole } from '../lib/permissions'
import Modal from './ui/Modal'
import { btnPrimary, btnSecondary } from '../lib/ui'

const COL_LABELS = { view: 'Voir', create: 'Créer', update: 'Modifier', delete: 'Supprimer' }
const COLS = ['view', ...CRUD_ACTIONS]

export default function PermissionsModal({ user, onClose }) {
  const queryClient = useQueryClient()
  const roleName = user.roleRel?.name || user.role
  const [matrix, setMatrix] = useState(() => effectiveMatrix(roleName, user.permissions))

  const toggle = (page, col) =>
    setMatrix((m) => ({ ...m, [page]: { ...m[page], [col]: !m[page][col] } }))

  const saveMutation = useMutation({
    mutationFn: async (permissions) => {
      const { error } = await supabase.from('User').update({ permissions }).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Droits mis à jour')
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const reset = () => {
    setMatrix(effectiveMatrix(roleName, null))
    saveMutation.mutate(null)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Droits — ${user.name}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={reset} disabled={saveMutation.isPending} className={btnSecondary}>
            Réinitialiser (suivre le rôle)
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(diffFromRole(roleName, matrix))}
            disabled={saveMutation.isPending}
            className={btnPrimary}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-c-border text-xs uppercase text-text-muted">
              <th className="p-2 font-medium">Page</th>
              {COLS.map((c) => (
                <th key={c} className="p-2 text-center font-medium">{COL_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_PAGES.map(({ key, label, readOnly }) => (
              <tr key={key} className="border-b border-c-border last:border-0">
                <td className="p-2 text-text-primary">{label}</td>
                {COLS.map((col) => {
                  const disabled = readOnly && col !== 'view'
                  return (
                    <td key={col} className="p-2 text-center">
                      {disabled ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={matrix[key][col]}
                          onChange={() => toggle(key, col)}
                          className="h-4 w-4 accent-accent-purple"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Ces droits s'appliquent à l'interface de cet utilisateur et priment sur son rôle.
        L'administrateur n'est jamais restreint.
      </p>
    </Modal>
  )
}
