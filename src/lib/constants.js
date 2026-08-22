export const ROLE_LABELS = {
  Administrateur: 'Administrateur',
  Manager: 'Manager',
  'Monteur vidéo': 'Monteur vidéo',
  Photographe: 'Photographe',
  'Community manager': 'Community manager',
  Commercial: 'Commercial',
}

export const ROLE_COLORS = {
  Administrateur: '#ef4444',
  Manager: '#9d3bf1',
  'Monteur vidéo': '#22d3ee',
  Photographe: '#10b981',
  'Community manager': '#ec4899',
  Commercial: '#f59e0b',
}

export const PROJECT_STATUS_LABELS = {
  PLANNING: 'Planification',
  FILMING: 'Tournage',
  EDITING: 'Montage',
  DELIVERED: 'Livré',
}

export const PROJECT_STATUS_COLORS = {
  PLANNING: '#22d3ee',
  FILMING: '#f59e0b',
  EDITING: '#9d3bf1',
  DELIVERED: '#10b981',
}

export const PROJECT_STATUS_OPTIONS = ['PLANNING', 'FILMING', 'EDITING', 'DELIVERED']

export const CLIENT_TYPE_LABELS = {
  PARTICULIER: 'Particulier',
  ENTREPRENEUR: 'Entrepreneur',
  CREATEUR: 'Créateur',
  ENTREPRISE: 'Entreprise',
  MARQUE: 'Marque',
  INSTITUTION: 'Institution',
  PARTENAIRE: 'Partenaire',
}

export const CLIENT_TYPE_OPTIONS = Object.keys(CLIENT_TYPE_LABELS)

export const CLIENT_STATUS_LABELS = {
  PROSPECT: 'Prospect',
  EN_DISCUSSION: 'En discussion',
  ACTIF: 'Actif',
  FIDELE: 'Fidèle',
  INACTIF: 'Inactif',
}

export const CLIENT_STATUS_COLORS = {
  PROSPECT: '#22d3ee',
  EN_DISCUSSION: '#f59e0b',
  ACTIF: '#10b981',
  FIDELE: '#9d3bf1',
  INACTIF: '#6e6a75',
}

export const CLIENT_STATUS_OPTIONS = Object.keys(CLIENT_STATUS_LABELS)

export const TASK_STATUS_LABELS = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  REVIEW: 'En révision',
  DONE: 'Terminé',
  BLOCKED: 'Bloqué',
}

export const TASK_STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']

export const TASK_PRIORITY_LABELS = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

export const TASK_PRIORITY_COLORS = {
  LOW: '#6e6a75',
  MEDIUM: '#22d3ee',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

export const TASK_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

/* ── Route access by role ─────────────────────────────────────── */
export const ROUTE_ACCESS = {
  dashboard:   ['Administrateur', 'Manager', 'Monteur vidéo', 'Photographe', 'Community manager', 'Commercial'],
  projects:    ['Administrateur', 'Manager', 'Monteur vidéo', 'Photographe', 'Community manager', 'Commercial'],
  clients:     ['Administrateur', 'Manager', 'Commercial'],
  calendar:    ['Administrateur', 'Manager', 'Monteur vidéo', 'Photographe', 'Community manager', 'Commercial'],
  tasks:       ['Administrateur', 'Manager', 'Monteur vidéo', 'Photographe', 'Community manager', 'Commercial'],
  productions: ['Administrateur', 'Manager', 'Monteur vidéo', 'Photographe'],
  editorial:   ['Administrateur', 'Manager', 'Community manager'],
  team:        ['Administrateur', 'Manager'],
  finance:     ['Administrateur', 'Manager'],
  invoices:    ['Administrateur', 'Manager', 'Commercial'],
  documents:   ['Administrateur', 'Manager', 'Commercial', 'Monteur vidéo', 'Photographe', 'Community manager'],
  ai:          ['Administrateur', 'Manager', 'Community manager', 'Monteur vidéo', 'Photographe', 'Commercial'],
  users:       ['Administrateur'],
  history:     ['Administrateur'],
  bilan:       ['Administrateur'],
  settings:    ['Administrateur', 'Manager'],
}

/* ── Invoice ──────────────────────────────────────────────────── */
export const INVOICE_STATUS_LABELS = {
  PENDING:   'En attente',
  PAID:      'Payée',
  OVERDUE:   'En retard',
  CANCELLED: 'Annulée',
}

export const INVOICE_STATUS_COLORS = {
  PENDING:   '#f59e0b',
  PAID:      '#10b981',
  OVERDUE:   '#ef4444',
  CANCELLED: '#6e6a75',
}

export const INVOICE_STATUS_OPTIONS = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']

/* ── Finance / Transactions ──────────────────────────────────── */
export const TRANSACTION_TYPE_LABELS = {
  INCOME:  'Revenu',
  EXPENSE: 'Dépense',
}

export const TRANSACTION_TYPE_COLORS = {
  INCOME:  '#10b981',
  EXPENSE: '#ef4444',
}

export const TRANSACTION_TYPE_OPTIONS = ['INCOME', 'EXPENSE']
