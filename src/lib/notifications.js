import { supabase } from './supabase'

// Helpers de création de notifications (insérées dans la table "Notification",
// livrées en temps réel au Topbar via Supabase Realtime).
//
// Toutes les fonctions sont « best-effort » : une erreur de notification ne doit
// jamais faire échouer l'action principale (enregistrer une facture, un projet…).
// Les erreurs sont donc loguées, pas propagées.

/**
 * Récupère les IDs des utilisateurs ayant l'un des rôles donnés.
 * @param {string[]} roleNames ex. ['Administrateur', 'Manager', 'Commercial']
 * @returns {Promise<string[]>}
 */
export async function fetchUserIdsByRole(roleNames) {
  const { data, error } = await supabase.from('User').select('id, roleRel:Role(name)')
  if (error) throw error
  const wanted = new Set(roleNames)
  return (data || [])
    .filter((u) => wanted.has(u.roleRel?.name))
    .map((u) => u.id)
}

/**
 * Insère une notification identique pour une liste de destinataires.
 * @param {string[]} userIds destinataires
 * @param {{ message: string, type?: string|null, link?: string|null }} payload
 * @param {{ exclude?: string|null }} [opts] id à exclure (typiquement l'auteur de l'action)
 */
export async function notifyUsers(userIds, { message, type = null, link = null }, opts = {}) {
  try {
    const { exclude = null } = opts
    const ids = [...new Set(userIds)].filter((id) => id && id !== exclude)
    if (ids.length === 0) return
    const rows = ids.map((userId) => ({ userId, message, type, link }))
    const { error } = await supabase.from('Notification').insert(rows)
    if (error) throw error
    // Notifications push hors-app (best-effort, ne bloque jamais l'action)
    sendPush(ids, { title: pushTitle(type), body: message, url: link })
  } catch (err) {
    console.error('Notification error:', err)
  }
}

// Titre de la notification push selon le type
function pushTitle(type) {
  switch (type) {
    case 'invoice': return 'Facturation'
    case 'project': return 'Projet'
    case 'objective': return 'Objectif'
    case 'task': return 'Tâche'
    default: return 'DK Manager'
  }
}

// Invoque l'Edge Function d'envoi de notifications push (best-effort).
async function sendPush(userIds, payload) {
  try {
    await supabase.functions.invoke('send-push', { body: { userIds, ...payload } })
  } catch (err) {
    console.error('Push error:', err)
  }
}

/**
 * Notifie tous les utilisateurs ayant l'un des rôles donnés.
 * @param {string[]} roleNames
 * @param {{ message: string, type?: string|null, link?: string|null }} payload
 * @param {{ exclude?: string|null }} [opts]
 */
export async function notifyRoles(roleNames, payload, opts = {}) {
  try {
    const ids = await fetchUserIdsByRole(roleNames)
    await notifyUsers(ids, payload, opts)
  } catch (err) {
    console.error('Notification error:', err)
  }
}
