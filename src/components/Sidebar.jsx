import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Calendar,
  ListTodo,
  Users,
  UserCog,
  Wallet,
  FileText,
  FolderOpen,
  Film,
  Rss,
  LogOut,
  Circle,
  X,
  Sparkles,
  History,
  Landmark,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/constants'

const NAV_ITEMS = [
  { key: 'dashboard',  path: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'projects',   path: '/projects',   label: 'Projets',         icon: FolderKanban },
  { key: 'clients',    path: '/clients',    label: 'Clients',         icon: Building2 },
  { key: 'calendar',   path: '/calendar',   label: 'Calendrier',      icon: Calendar },
  { key: 'tasks',      path: '/tasks',      label: 'Tâches',          icon: ListTodo },
  { key: 'productions',path: '/productions',label: 'Productions',     icon: Film },
  { key: 'editorial',  path: '/editorial',  label: 'Éditorial',       icon: Rss },
  { key: 'ai',         path: '/ai',         label: 'Assistant IA',    icon: Sparkles },
  { key: 'team',       path: '/team',       label: 'Équipe',          icon: Users },
  { key: 'finance',    path: '/finance',    label: 'Finance',         icon: Wallet },
  { key: 'invoices',   path: '/invoices',   label: 'Facturation',     icon: FileText },
  { key: 'documents',  path: '/documents',  label: 'Documents',       icon: FolderOpen },
  { key: 'bilan',      path: '/bilan',      label: 'Bilan global',    icon: Landmark },
  { key: 'users',      path: '/users',      label: 'Utilisateurs',    icon: UserCog },
  { key: 'history',    path: '/history',    label: 'Historique',      icon: History },
]

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, hasAccess, signOut, onlineCount } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const items = NAV_ITEMS.filter((item) => hasAccess(item.key))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-c-border bg-bg-panel transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-6">
          <img src="/dk-mark-badge.png" alt="DK Production" className="h-8 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-text-primary">DK Production</p>
            <p className="truncate text-xs leading-tight text-text-muted">Production Manager</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ key, path, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-purple/15 text-accent-purple'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-c-border px-4 py-3">
          <div className="mb-3 flex items-center gap-2 px-2 text-xs text-text-secondary">
            <Circle size={8} className="fill-c-success text-c-success" />
            {onlineCount} utilisateur{onlineCount > 1 ? 's' : ''} en ligne
          </div>
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={user?.name} bg={user?.avatarBg} src={user?.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{user?.name}</p>
              <Badge color={ROLE_COLORS[user?.roleRel?.name || user?.role]}>{ROLE_LABELS[user?.roleRel?.name || user?.role] || user?.roleRel?.name || user?.role}</Badge>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-c-danger"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
