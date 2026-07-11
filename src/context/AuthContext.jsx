import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { ROUTE_ACCESS } from '../lib/constants'


const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onlineCount, setOnlineCount] = useState(0)
  const [onlineIds, setOnlineIds] = useState([])

  const syncUser = useCallback(async (sess) => {
    if (!sess?.user) {
      setUser(null)
      return
    }
    const { data, error } = await supabase
      .from('User')
      .select('*, roleRel:Role(id, name)')
      .eq('id', sess.user.id)
      .maybeSingle()

    if (error || !data) {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      toast.error('Profil introuvable. Veuillez vous reconnecter.')
      return
    }

    // Auto-promote to Administrateur for local development/testing convenience if no role is set
    if (!data.roleId || !data.roleRel) {
      const { data: adminRole } = await supabase
        .from('Role')
        .select('id')
        .eq('name', 'Administrateur')
        .maybeSingle()

      if (adminRole) {
        const { data: updatedData, error: updateErr } = await supabase
          .from('User')
          .update({ roleId: adminRole.id })
          .eq('id', sess.user.id)
          .select('*, roleRel:Role(id, name)')
          .maybeSingle()
        if (!updateErr && updatedData) {
          setUser(updatedData)
          return
        }
      }
    }

    setUser(data)
  }, [])

  useEffect(() => {
    let active = true

    const boot = async () => {
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000))
      const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session)
      const sess = await Promise.race([sessionPromise, timeout])
      if (!active) return
      setSession(sess)
      if (sess) await syncUser(sess)
      if (active) setLoading(false)
    }
    boot()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(sess)
        return
      }
      setSession(sess)
      if (sess) {
        syncUser(sess)
      } else {
        setUser(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [syncUser])

  // Supabase Realtime presence — global "online users" indicator
  useEffect(() => {
    if (!user) return

    const room = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    })

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState()
        const ids = Object.keys(state)
        setOnlineCount(ids.length)
        setOnlineIds(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(room)
    }
  }, [user])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw error
    return data
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const hasAccess = (route) => {
    if (!user) return false
    const roleName = user.roleRel?.name || user.role
    const allowed = ROUTE_ACCESS[route]
    if (!allowed) return true // unknown routes are not restricted
    return allowed.includes(roleName)
  }

  const value = {
    session,
    user,
    loading,
    onlineCount,
    onlineIds,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    hasAccess,
    refreshUser: () => syncUser(session),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
