import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Bell, MessageSquare, LogOut, ChevronDown, Check, Info, Users } from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';
import './Topbar.css';

export default function Topbar() {
    const { user, activeUsers, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const menuRef = useRef(null);
    const notifRef = useRef(null);

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
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [api]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
            if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifs(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await api.request('/api/notifications');
            setNotifications(data.notifications || []);
        } catch (err) {
            console.error(err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.request(`/api/notifications/${id}/read`, { method: 'PUT' });
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (err) {
            console.error(err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.request('/api/notifications/read-all', { method: 'PUT' });
            setNotifications(notifications.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error(err);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <header className="topbar">
            <div className="search-container">
                <Search className="search-icon" size={18} />
                <input
                    type="text"
                    placeholder="Rechercher projets, tâches, ou talents..."
                    className="search-input"
                />
            </div>

            <div className="topbar-actions">
                <div className="active-users" title="Utilisateurs actifs (temps rÃ©el)">
                    <Users size={16} />
                    <span className="active-users-count">{typeof activeUsers === 'number' ? activeUsers : '...'}</span>
                </div>

                <div className="profile-menu-container" ref={notifRef} style={{ position: 'relative' }}>
                    <button className="action-btn" onClick={() => setShowNotifs(!showNotifs)}>
                        <Bell size={20} />
                        {unreadCount > 0 && <span className="badge-indicator">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                    </button>

                    {showNotifs && (
                        <div className="profile-dropdown" style={{
                            position: 'absolute', top: '100%', right: '0', marginTop: '8px',
                            background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px', minWidth: '320px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50,
                            overflow: 'hidden'
                        }}>
                            <div className="flex justify-between items-center p-3 border-b border-light">
                                <h3 className="text-white font-bold text-sm m-0">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button className="text-xs text-purple hover:text-white transition-colors" onClick={markAllAsRead}>
                                        Tout marquer lu
                                    </button>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-secondary text-sm">
                                        Aucune notification pour le moment.
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div key={notif.id} className={`p-3 border-b border-light flex gap-3 ${!notif.read ? 'bg-[rgba(157,59,241,0.05)]' : ''}`} onClick={() => { if (!notif.read) markAsRead(notif.id); }}>
                                            <div className="mt-1 text-purple">
                                                {notif.type === 'SUCCESS' ? <Check size={16} color="#10b981" /> : <Info size={16} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm m-0 ${!notif.read ? 'text-white font-medium' : 'text-secondary'}`}>{notif.message}</p>
                                                <span className="text-[10px] text-muted">{new Date(notif.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            {!notif.read && <div className="w-2 h-2 rounded-full bg-purple mt-2 flex-shrink-0"></div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button className="action-btn">
                    <MessageSquare size={20} />
                </button>

                <div className="profile-menu-container" ref={menuRef} style={{ position: 'relative' }}>
                    <button
                        className="profile-btn"
                        onClick={() => setShowMenu(!showMenu)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}
                    >
                        <div className="flex flex-col text-right hidden sm:flex">
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'white', lineHeight: '1.2' }}>{user?.name || 'Utilisateur'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user ? ROLE_LABELS[user.role] : ''}</span>
                        </div>
                        <div className="avatar" style={{ backgroundColor: user?.avatarBg || '#9d3bf1', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#121016', fontWeight: 'bold' }}>
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <ChevronDown size={14} color="var(--text-muted)" />
                    </button>

                    {showMenu && (
                        <div className="profile-dropdown" style={{
                            position: 'absolute', top: '100%', right: '0', marginTop: '8px',
                            background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px', padding: '8px', minWidth: '180px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50
                        }}>
                            <button
                                onClick={logout}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                    padding: '10px 12px', background: 'transparent', border: 'none',
                                    color: '#ef4444', fontSize: '13px', fontWeight: '500',
                                    cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <LogOut size={16} />
                                Déconnexion
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
