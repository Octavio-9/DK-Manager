import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/constants'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import { inputClass, labelClass, btnPrimary, cardClass } from '../lib/ui'

const AVATAR_COLORS = ['#9d3bf1', '#22d3ee', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#6e6a75']

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [avatarBg, setAvatarBg] = useState(user?.avatarBg || '#9d3bf1')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('User').update({ name: name.trim(), avatarBg }).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshUser()
      toast.success('Profil mis à jour')
    },
    onError: (err) => toast.error(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.')
      if (password !== confirmPassword) throw new Error('Les mots de passe ne correspondent pas.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Mot de passe mis à jour')
      setPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className={cardClass}>
        <h2 className="mb-4 text-base font-semibold text-text-primary">Profil</h2>

        <div className="mb-5 flex items-center gap-4">
          <Avatar name={name || user?.name} bg={avatarBg} size="lg" />
          <div>
            <p className="font-medium text-text-primary">{user?.email}</p>
            <Badge color={ROLE_COLORS[user?.role]}>{ROLE_LABELS[user?.role] || user?.role}</Badge>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            profileMutation.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Nom complet</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Couleur de l'avatar</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarBg(color)}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                >
                  {avatarBg === color && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={profileMutation.isPending} className={btnPrimary}>
            Enregistrer
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="mb-4 text-base font-semibold text-text-primary">Sécurité</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            passwordMutation.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className={labelClass}>Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={passwordMutation.isPending} className={btnPrimary}>
            Changer le mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}
