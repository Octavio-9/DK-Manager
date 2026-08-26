import { ROUTE_ACCESS } from './constants'

// Pages contrôlables. readOnly = pas d'actions CRUD (seule la visibilité compte).
export const PERMISSION_PAGES = [
  { key: 'dashboard', label: 'Tableau de bord', readOnly: true },
  { key: 'projects', label: 'Projets' },
  { key: 'clients', label: 'Clients' },
  { key: 'calendar', label: 'Calendrier' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'productions', label: 'Productions' },
  { key: 'editorial', label: 'Éditorial' },
  { key: 'team', label: 'Équipe', readOnly: true },
  { key: 'finance', label: 'Finances' },
  { key: 'invoices', label: 'Factures' },
  { key: 'documents', label: 'Documents' },
  { key: 'ai', label: 'IA', readOnly: true },
  { key: 'users', label: 'Utilisateurs' },
  { key: 'history', label: 'Historique', readOnly: true },
  { key: 'bilan', label: 'Bilan', readOnly: true },
  { key: 'settings', label: 'Paramètres', readOnly: true },
]

export const CRUD_ACTIONS = ['create', 'update', 'delete']

// Actions déjà réservées à l'admin dans le code actuel (à ne pas desserrer).
export const ADMIN_ONLY_DEFAULT = {
  finance: ['update', 'delete'],
}

export function isAdminRole(roleName) {
  return roleName === 'Administrateur'
}

export function defaultView(roleName, page) {
  const allowed = ROUTE_ACCESS[page]
  if (!allowed) return true // route inconnue = non restreinte
  return allowed.includes(roleName)
}

export function defaultCan(roleName, page, action) {
  if (ADMIN_ONLY_DEFAULT[page]?.includes(action)) return false // non-admin par défaut
  return defaultView(roleName, page)
}

export function computeHasAccess(roleName, permissions, page) {
  if (isAdminRole(roleName)) return true
  const ov = permissions?.[page]?.view
  if (ov === true) return true
  if (ov === false) return false
  return defaultView(roleName, page)
}

export function computeCan(roleName, permissions, page, action) {
  if (isAdminRole(roleName)) return true
  if (!computeHasAccess(roleName, permissions, page)) return false
  const ov = permissions?.[page]?.[action]
  if (ov === false) return false
  if (ov === true) return true
  return defaultCan(roleName, page, action)
}

// Matrice booléenne effective (pour préremplir l'UI d'administration).
export function effectiveMatrix(roleName, permissions) {
  const m = {}
  for (const { key } of PERMISSION_PAGES) {
    m[key] = {
      view: computeHasAccess(roleName, permissions, key),
      create: computeCan(roleName, permissions, key, 'create'),
      update: computeCan(roleName, permissions, key, 'update'),
      delete: computeCan(roleName, permissions, key, 'delete'),
    }
  }
  return m
}

// Convertit une matrice éditée en surcharges éparses (écarts au défaut du rôle).
export function diffFromRole(roleName, matrix) {
  const out = {}
  for (const { key, readOnly } of PERMISSION_PAGES) {
    const pageDiff = {}
    if (matrix[key].view !== defaultView(roleName, key)) pageDiff.view = matrix[key].view
    if (!readOnly) {
      for (const action of CRUD_ACTIONS) {
        if (matrix[key][action] !== defaultCan(roleName, key, action)) {
          pageDiff[action] = matrix[key][action]
        }
      }
    }
    if (Object.keys(pageDiff).length) out[key] = pageDiff
  }
  return Object.keys(out).length ? out : null
}
