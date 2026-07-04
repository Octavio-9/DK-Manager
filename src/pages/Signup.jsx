import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, User, Eye, EyeOff, Loader2, Clapperboard, MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmailSent, setConfirmEmailSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !password || !confirmPassword) {
      setError('Merci de remplir tous les champs.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      const data = await signUp(name, email, password)
      if (data?.session) {
        navigate('/dashboard')
      } else {
        setConfirmEmailSent(true)
      }
    } catch (err) {
      setError(err.message || "Impossible de créer le compte.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast.error(err.message || 'Connexion Google impossible.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-dark px-4">
      <div className="auth-orb -left-32 -top-32 h-96 w-96 bg-accent-purple" />
      <div className="auth-orb -right-32 top-1/3 h-80 w-80 bg-accent-cyan" style={{ animationDelay: '-6s' }} />
      <div className="auth-orb bottom-[-10rem] left-1/3 h-72 w-72 bg-accent-purple" style={{ animationDelay: '-12s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-purple">
            <Clapperboard size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">DK Production</h1>
          <p className="text-sm text-text-secondary">Production Manager</p>
        </div>

        <div className="rounded-xl border border-c-border bg-bg-card p-8 shadow-2xl">
          <h2 className="mb-6 text-lg font-semibold text-text-primary">Créer un compte</h2>

          {confirmEmailSent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-cyan/15">
                <MailCheck size={24} className="text-accent-cyan" />
              </div>
              <p className="text-sm text-text-secondary">
                Un email de confirmation a été envoyé à <strong className="text-text-primary">{email}</strong>.
                Cliquez sur le lien reçu pour activer votre compte.
              </p>
              <Link to="/login" className="font-medium text-accent-purple hover:underline">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className={labelClass}>Nom complet</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jean Dupont"
                      className={`${inputClass} pl-9`}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      className={`${inputClass} pl-9`}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className={labelClass}>Mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pl-9 pr-9`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pl-9`}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Créer mon compte
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-c-border" />
                <span className="text-xs text-text-muted">OU</span>
                <div className="h-px flex-1 bg-c-border" />
              </div>

              <button onClick={handleGoogle} disabled={googleLoading} className={`${btnSecondary} w-full`}>
                {googleLoading && <Loader2 size={16} className="animate-spin" />}
                Continuer avec Google
              </button>

              <p className="mt-6 text-center text-sm text-text-secondary">
                Déjà un compte ?{' '}
                <Link to="/login" className="font-medium text-accent-purple hover:underline">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
