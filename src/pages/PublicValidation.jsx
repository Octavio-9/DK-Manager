import { useParams, Navigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, Film, MapPin, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ── Fetch ───────────────────────────────────────────────────────── */

async function fetchProductionByToken(token) {
  const { data, error } = await supabase
    .from('Production')
    .select('*, projectRel:Project(id, name, clientRel:Client(id, name)), files:ProductionFile(*)')
    .eq('validationToken', token)
    .maybeSingle()
  if (error) throw error
  return data
}

/* ── Status display ─────────────────────────────────────────────── */

const STATUS_META = {
  PENDING:          { label: 'En attente de validation', color: '#f59e0b', Icon: Clock },
  APPROVED:         { label: 'Approuvé',                 color: '#10b981', Icon: CheckCircle2 },
  CHANGES_REQUESTED:{ label: 'Modifications demandées',  color: '#ef4444', Icon: XCircle },
}

const PRODUCTION_STATUS = {
  PLANNED:  { label: 'Planifié',    color: '#22d3ee' },
  RECORDED: { label: 'Enregistré',  color: '#f59e0b' },
  EDITING:  { label: 'En montage',  color: '#9d3bf1' },
  READY:    { label: 'Prêt',        color: '#10b981' },
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function PublicValidation() {
  const { token } = useParams()
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: production, isLoading, isError } = useQuery({
    queryKey: ['public-validation', token],
    queryFn: () => fetchProductionByToken(token),
    retry: false,
  })

  const validateMutation = useMutation({
    mutationFn: async ({ status }) => {
      const { error } = await supabase
        .from('Production')
        .update({
          validationStatus: status,
          clientComment: comment || null,
          validatedAt: new Date().toISOString(),
        })
        .eq('validationToken', token)
      if (error) throw error
    },
    onSuccess: () => setSubmitted(true),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="animate-pulse text-text-secondary">Chargement…</div>
      </div>
    )
  }

  if (isError || !production) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-c-danger/10">
            <XCircle size={32} className="text-c-danger" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">Lien invalide</h1>
          <p className="mt-2 text-sm text-text-secondary">Ce lien de validation est introuvable ou a expiré.</p>
        </div>
      </div>
    )
  }

  if (submitted || (production.validationStatus !== 'PENDING')) {
    const meta = STATUS_META[production.validationStatus] || STATUS_META.PENDING
    const Icon = meta.Icon
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark px-4">
        <div className="w-full max-w-md rounded-2xl border border-c-border bg-bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: meta.color + '22' }}>
            <Icon size={32} style={{ color: meta.color }} />
          </div>
          <h1 className="text-xl font-bold text-text-primary">{meta.label}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {submitted ? 'Votre réponse a bien été enregistrée. Merci !' : 'Ce livrable a déjà été validé.'}
          </p>
          {production.clientComment && (
            <div className="mt-4 rounded-lg bg-bg-panel p-3 text-left text-sm text-text-secondary italic">
              &ldquo;{production.clientComment}&rdquo;
            </div>
          )}
          <div className="mt-6 text-xs text-text-muted">
            Livrable : <span className="font-medium text-text-primary">{production.title}</span>
          </div>
        </div>
      </div>
    )
  }

  const prodStatus = PRODUCTION_STATUS[production.status] || { label: production.status, color: '#6e6a75' }

  return (
    <div className="min-h-screen bg-bg-dark px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-purple">
            <Film size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Validation de livrable</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {production.projectRel?.clientRel?.name
              ? `Bonjour, ${production.projectRel.clientRel.name}`
              : 'Bienvenue'}
          </p>
        </div>

        {/* Production card */}
        <div className="mb-6 rounded-2xl border border-c-border bg-bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{production.title}</h2>
              {production.projectRel && (
                <p className="mt-0.5 text-sm text-text-secondary">Projet : {production.projectRel.name}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium" style={{ background: prodStatus.color + '22', color: prodStatus.color }}>
              {prodStatus.label}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-4 text-sm text-text-secondary">
            {production.type && (
              <div className="flex items-center gap-1.5">
                <Film size={14} className="text-text-muted" />
                {production.type}
              </div>
            )}
            {production.recordingDate && (
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-text-muted" />
                {new Date(production.recordingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            )}
            {production.location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-text-muted" />
                {production.location}
              </div>
            )}
          </div>

          {/* Files */}
          {production.files?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-text-muted">Fichiers joints</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {production.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-c-border bg-bg-panel p-3 text-sm text-text-secondary transition-colors hover:border-accent-purple/50 hover:text-text-primary"
                  >
                    <span className="text-xl shrink-0">
                      {file.url?.endsWith('.pdf') ? '📕' : file.url?.match(/\.(jpg|jpeg|png|webp|gif)$/) ? '🖼️' : file.url?.match(/\.(mp4|mov|avi)$/) ? '🎬' : '📎'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-text-primary">{file.name || file.url?.split('/').pop()}</p>
                      {file.size && <p className="text-[10px] text-text-muted">{Math.round(file.size / 1024)} KB</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Validation form */}
        <div className="rounded-2xl border border-c-border bg-bg-card p-6 shadow-xl">
          <h3 className="mb-4 text-base font-semibold text-text-primary">Votre retour</h3>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Commentaire (optionnel)</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Partagez vos retours, modifications souhaitées…"
              className="w-full rounded-xl border border-c-border bg-bg-panel px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent-purple"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => validateMutation.mutate({ status: 'APPROVED' })}
              disabled={validateMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#10b981' }}
            >
              <CheckCircle2 size={18} />
              Approuver le livrable
            </button>
            <button
              onClick={() => validateMutation.mutate({ status: 'CHANGES_REQUESTED' })}
              disabled={validateMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-c-danger py-3 text-sm font-semibold text-c-danger transition-all hover:bg-c-danger/10 active:scale-95"
            >
              <XCircle size={18} />
              Demander des modifications
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Lien de validation sécurisé — DK Production Manager
        </p>
      </div>
    </div>
  )
}
