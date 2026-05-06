import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

// ─── Route Permissions ────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
    admin: ['dashboard', 'projects', 'clients', 'calendar', 'tasks', 'team', 'users'],
    manager: ['dashboard', 'projects', 'clients', 'calendar', 'tasks', 'team'],
    operator: ['dashboard', 'projects', 'clients', 'calendar', 'tasks'],
    viewer: ['dashboard', 'clients'],
};

export const ROLE_LABELS = {
    admin: 'Administrateur',
    manager: 'Chef de Projet',
    operator: 'Opérateur',
    viewer: 'Observateur',
};

export const ROLE_COLORS = {
    admin: '#ef4444',
    manager: '#9d3bf1',
    operator: '#22d3ee',
    viewer: '#6e6a75',
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [booting, setBooting] = useState(true);
    const [activeUsers, setActiveUsers] = useState(null);

    const api = useMemo(() => {
        async function request(path, { method = 'GET', body } = {}) {
            const res = await fetch(path, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
            return data;
        }

        return { request };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await api.request('/api/auth/me');
                if (!cancelled) setUser(data.user ?? null);
            } catch {
                if (!cancelled) setUser(null);
            } finally {
                if (!cancelled) setBooting(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [api]);

    useEffect(() => {
        if (!user) {
            setActiveUsers(null);
            return undefined;
        }

        let cancelled = false;
        const es = new EventSource('/api/presence/stream', { withCredentials: true });

        const onPresence = (evt) => {
            if (cancelled) return;
            try {
                const data = JSON.parse(evt.data);
                if (typeof data?.activeUsers === 'number') setActiveUsers(data.activeUsers);
            } catch {
                // ignore parse errors
            }
        };

        es.addEventListener('presence', onPresence);
        es.onerror = () => {
            // EventSource auto-reconnects. Keep last known value.
        };

        return () => {
            cancelled = true;
            es.removeEventListener('presence', onPresence);
            es.close();
        };
    }, [user]);

    const login = async (email, password) => {
        try {
            const data = await api.request('/api/auth/login', { method: 'POST', body: { email, password } });
            setUser(data.user);
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || 'Email ou mot de passe incorrect.' };
        }
    };

    const register = async (name, email, password, role) => {
        try {
            const data = await api.request('/api/auth/signup', { method: 'POST', body: { name, email, password, role } });
            setUser(data.user);
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || "Impossible de s'inscrire." };
        }
    };

    const logout = async () => {
        try {
            await api.request('/api/auth/logout', { method: 'POST' });
        } finally {
            setUser(null);
        }
    };

    const googleLogin = async (credential) => {
        try {
            const data = await api.request('/api/auth/google', { method: 'POST', body: { credential } });
            setUser(data.user);
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || 'Connexion Google échouée.' };
        }
    };

    const canAccess = (route) => {
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role]?.includes(route) ?? false;
    };

    return (
        <AuthContext.Provider value={{ user, booting, activeUsers, login, register, logout, googleLogin, canAccess }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
