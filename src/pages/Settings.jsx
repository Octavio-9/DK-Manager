import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Camera, Trash2, Bell, BellOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/constants'
import { isPushSupported, getPushPermission, enablePush, disablePush } from '../lib/push'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import { inputClass, labelClass, btnPrimary, btnSecondary, cardClass } from '../lib/ui'

const AVATAR_COLORS = ['#9d3bf1', '#22d3ee', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#6e6a75']

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [avatarBg, setAvatarBg] = useState(user?.avatarBg || '#9d3bf1')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null)
  const [uploading, setUploading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Notifications push (hors-app). État initial calculé de façon synchrone (support + permission).
  const [pushState, setPushState] = useState(() =>
    isPushSupported() ? getPushPermission() : 'unsupported',
  ) // default | granted | denied | unsupported
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => {})
  }, [])

  const handleEnablePush = async () => {
    setPushBusy(true)
    try {
      await enablePush(user.id)
      setPushEnabled(true)
      setPushState('granted')
      toast.success('Notifications activées sur cet appareil')
    } catch (err) {
      toast.error(err.message)
      setPushState(getPushPermission())
    } finally {
      setPushBusy(false)
    }
  }

  const handleDisablePush = async () => {
    setPushBusy(true)
    try {
      await disablePush()
      setPushEnabled(false)
      toast.success('Notifications désactivées sur cet appareil')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPushBusy(false)
    }
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image (PNG, JPEG…).')
      return
    }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `avatars/${user.id}_${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('documents').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      toast.success('Photo prête — cliquez sur « Enregistrer » pour valider.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('User')
        .update({ name: name.trim(), avatarBg, avatarUrl })
        .eq('id', user.id)
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
          <Avatar name={name || user?.name} bg={avatarBg} src={avatarUrl} size="lg" />
          <div className="space-y-2">
            <p className="font-medium text-text-primary">{user?.email}</p>
            <Badge color={ROLE_COLORS[user?.role]}>{ROLE_LABELS[user?.role] || user?.role}</Badge>
            <div className="flex flex-wrap gap-2 pt-1">
              <label className={`${btnSecondary} cursor-pointer px-3 py-1.5 text-xs`}>
                <Camera size={14} />
                {uploading ? 'Envoi…' : avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-c-danger"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              )}
            </div>
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
            <label className={labelClass}>Couleur de l'avatar (utilisée sans photo)</label>
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

      <div className={cardClass}>
        <h2 className="mb-1 text-base font-semibold text-text-primary">Notifications push</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Recevez les notifications même lorsque l'app est fermée (tâche assignée, facture payée,
          objectif atteint…). À activer sur chaque appareil.
        </p>
        {pushState === 'unsupported' ? (
          <p className="text-sm text-text-muted">
            Non supporté sur ce navigateur. Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil
            (Partager → « Sur l'écran d'accueil »), puis rouvrez-la depuis l'icône.
          </p>
        ) : pushState === 'denied' ? (
          <p className="text-sm text-c-danger">
            Notifications bloquées pour cette app. Réautorisez-les dans les réglages du navigateur.
          </p>
        ) : pushEnabled ? (
          <button type="button" onClick={handleDisablePush} disabled={pushBusy} className={btnSecondary}>
            <BellOff size={16} />
            Désactiver sur cet appareil
          </button>
        ) : (
          <button type="button" onClick={handleEnablePush} disabled={pushBusy} className={btnPrimary}>
            <Bell size={16} />
            Activer sur cet appareil
          </button>
        )}
      </div>
    </div>
  )
}
