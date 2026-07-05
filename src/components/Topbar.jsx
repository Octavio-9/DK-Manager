import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu, Settings as SettingsIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'
import Avatar from './ui/Avatar'

const PAGE_TITLES = {
  '/dashboard': 'Tableau de bord',
  '/projects': 'Projets',
  '/clients': 'Clients',
  '/finance': 'Finance',
  '/calendar': 'Calendrier',
  '/tasks': 'Tâches',
  '/invoices': 'Facturation',
  '/team': 'Équipe',
  '/users': 'Utilisateurs',
  '/settings': 'Paramètres',
}

export default function Topbar({ onMenuClick = () => {} }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const title = PAGE_TITLES[location.pathname] || 'DK Production Manager'
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const { data } = await supabase
        .from('Notification')
        .select('*')
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(10)
      setNotifications(data || [])
    }
    load()

    const channel = supabase
      .channel('notifications-' + user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Notification', filter: `userId=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev].slice(0, 10))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAsRead = async (notif) => {
    if (notif.read) return
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))
    await supabase.from('Notification').update({ read: true }).eq('id', notif.id)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-c-border bg-bg-dark px-3 sm:h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-base font-semibold text-text-primary sm:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-c-danger px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-c-border bg-bg-card p-2 shadow-2xl sm:w-80">
              <p className="px-2 py-1 text-xs font-semibold text-text-muted">Notifications</p>
              {notifications.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-text-muted">
                  Aucune notification
                </p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n)}
                      className={`block w-full rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-bg-hover ${
                        n.read ? 'text-text-secondary' : 'text-text-primary'
                      }`}
                    >
                      <p className="flex items-center gap-2">
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />}
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{formatDateTime(n.createdAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-bg-hover"
          >
            <Avatar name={user?.name} bg={user?.avatarBg} size="sm" />
            <ChevronDown size={16} className="text-text-muted" />
          </button>

          {showProfile && (
            <div className="absolute right-0 z-40 mt-2 w-48 rounded-xl border border-c-border bg-bg-card p-1 shadow-2xl">
              <button
                onClick={() => {
                  setShowProfile(false)
                  navigate('/settings')
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-hover"
              >
                <SettingsIcon size={16} />
                Paramètres
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-c-danger transition-colors hover:bg-bg-hover"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
