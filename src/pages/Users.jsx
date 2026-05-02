import React, { useState, useEffect, useMemo } from 'react';
import {
    UserCog, Shield, Users as UsersIcon, Eye, Plus, Search, X,
    Edit2, Trash2, Check, Lock, UserCheck, AlertCircle
} from 'lucide-react';
import './Users.css';

const ROLES = [
    { id: 'admin', label: 'Administrateur', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', description: 'Accès complet', icon: Shield },
    { id: 'manager', label: 'Chef de Projet', color: '#9d3bf1', bg: 'rgba(157,59,241,0.15)', description: 'Gestion projets', icon: UserCog },
    { id: 'operator', label: 'Opérateur', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)', description: 'Modif. tâches', icon: UsersIcon },
    { id: 'viewer', label: 'Observateur', color: '#6e6a75', bg: 'rgba(110,106,117,0.15)', description: 'Lecture seule', icon: Eye },
];

function getRoleConfig(roleId) {
    return ROLES.find(r => r.id === roleId) || ROLES[3];
}

function RoleBadge({ roleId }) {
    const role = getRoleConfig(roleId);
    return (
        <span className="role-badge" style={{ color: role.color, backgroundColor: role.bg }}>
            <role.icon size={11} />
            {role.label}
        </span>
    );
}

function StatusBadge({ status }) {
    return (
        <span className={`status-dot-badge ${status}`}>
            <span className="status-dot" />
            {status === 'active' ? 'Actif' : 'Inactif'}
        </span>
    );
}

function UserModal({ user, onClose, onSave }) {
    const [form, setForm] = useState(
        user
            ? { name: user.name, email: user.email, role: user.role, password: '', status: user.status || 'active' }
            : { name: '', email: '', role: 'viewer', password: '', status: 'active' }
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim()) return;
        onSave(form);
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2>{user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
                    <button className="btn btn-ghost p-1" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>Nom complet</label>
                        <input className="input" placeholder="Ex: Jean Dupont" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Adresse email</label>
                        <input className="input" type="email" placeholder="jean@dkproduction.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    
                    <div className="form-group">
                        <label>Mot de passe {user && <span className="text-muted font-normal text-xs">(laisser vide pour ne pas changer)</span>}</label>
                        <input className="input" type="password" placeholder={user ? "••••••••" : "Mot de passe initial"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!user} />
                    </div>

                    <div className="form-group">
                        <label>Rôle</label>
                        <div className="roles-selector">
                            {ROLES.map(role => (
                                <button type="button" key={role.id} className={`role-option ${form.role === role.id ? 'selected' : ''}`} style={form.role === role.id ? { borderColor: role.color, backgroundColor: role.bg } : {}} onClick={() => setForm({ ...form, role: role.id })}>
                                    <div className="role-option-icon" style={{ color: role.color }}><role.icon size={16} /></div>
                                    <div className="role-option-info">
                                        <span className="role-option-name" style={form.role === role.id ? { color: role.color } : {}}>{role.label}</span>
                                        <span className="role-option-desc">{role.description}</span>
                                    </div>
                                    {form.role === role.id && <Check size={14} style={{ color: role.color, marginLeft: 'auto' }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions mt-6">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary shadow-glow">
                            {user ? 'Enregistrer' : 'Créer l\'utilisateur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function DeleteModal({ user, onClose, onConfirm }) {
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box-sm">
                <div className="delete-modal-icon">
                    <Trash2 size={24} style={{ color: '#ef4444' }} />
                </div>
                <h2 className="delete-modal-title">Supprimer l'utilisateur ?</h2>
                <p className="delete-modal-desc">
                    Voulez-vous vraiment supprimer <strong style={{ color: 'white' }}>{user.name}</strong> ?
                    Cette action est irréversible.
                </p>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
                    <button className="btn btn-danger" onClick={onConfirm}>Supprimer</button>
                </div>
            </div>
        </div>
    );
}

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    
    const [modalType, setModalType] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);

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
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.request('/api/users');
            setUsers(data.users || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (form) => {
        try {
            if (selectedUser) {
                const updated = await api.request(`/api/users/${selectedUser.id}`, {
                    method: 'PUT',
                    body: form
                });
                setUsers(users.map(u => u.id === selectedUser.id ? updated.user : u));
            } else {
                const created = await api.request('/api/users', {
                    method: 'POST',
                    body: form
                });
                setUsers([created.user, ...users]);
            }
            setModalType(null);
            setSelectedUser(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;
        try {
            await api.request(`/api/users/${selectedUser.id}`, { method: 'DELETE' });
            setUsers(users.filter(u => u.id !== selectedUser.id));
            setModalType(null);
            setSelectedUser(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const stats = [
        { label: 'Utilisateurs Total', value: users.length, icon: UsersIcon, color: '#9d3bf1' },
        { label: 'Administrateurs', value: users.filter(u => u.role === 'admin').length, icon: Shield, color: '#ef4444' },
        { label: 'Comptes Actifs', value: users.filter(u => u.status === 'active').length, icon: UserCheck, color: '#10b981' },
        { label: 'Accès Restreint', value: users.filter(u => u.role === 'viewer').length, icon: Lock, color: '#6e6a75' },
    ];

    const filtered = users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const matchStatus = filterStatus === 'all' || u.status === filterStatus;
        return matchSearch && matchRole && matchStatus;
    });

    return (
        <div className="users-page">
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Gestion des Utilisateurs</h1>
                    <p className="text-sm text-muted">Gérer les accès et les rôles des {users.length} membres</p>
                </div>
                <button className="btn btn-primary shadow-glow" onClick={() => { setSelectedUser(null); setModalType('create'); }}>
                    <Plus size={18} />
                    <span>Nouvel utilisateur</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="users-stats-grid mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="stat-card card">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-xs uppercase tracking-wider text-muted font-bold">{stat.label}</div>
                            <div style={{ backgroundColor: `${stat.color}22`, color: stat.color, padding: '6px', borderRadius: '6px' }}>
                                <stat.icon size={18} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-white">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="users-filters mb-5 flex gap-3 flex-wrap items-center">
                <div className="search-wrapper">
                    <Search size={15} className="search-icon" />
                    <input className="search-input users-search" placeholder="Rechercher un utilisateur..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="filter-group">
                    {['all', ...ROLES.map(r => r.id)].map(role => {
                        const cfg = ROLES.find(r => r.id === role);
                        return (
                            <button key={role} className={`filter-chip ${filterRole === role ? 'active' : ''}`} style={filterRole === role && cfg ? { borderColor: cfg.color, color: cfg.color, backgroundColor: cfg.bg } : {}} onClick={() => setFilterRole(role)}>
                                {role === 'all' ? 'Tous les rôles' : cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="card users-table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>Utilisateur</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Depuis</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center text-muted py-8">Chargement...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={5} className="empty-row">Aucun utilisateur trouvé</td></tr>
                        ) : filtered.map(user => (
                            <tr key={user.id} className="user-row">
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="user-avatar" style={{ backgroundColor: user.avatarBg }}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="user-name">{user.name}</div>
                                            <div className="user-email">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><RoleBadge roleId={user.role} /></td>
                                <td><StatusBadge status={user.status} /></td>
                                <td className="text-muted text-sm">{new Date(user.joined).toLocaleDateString('fr-FR')}</td>
                                <td>
                                    <div className="row-actions flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-ghost btn-sm action-btn" title="Modifier" onClick={() => { setSelectedUser(user); setModalType('edit'); }}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm action-btn danger-btn" title="Supprimer" onClick={() => { setSelectedUser(user); setModalType('delete'); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(modalType === 'create' || modalType === 'edit') && (
                <UserModal user={modalType === 'edit' ? selectedUser : null} onClose={() => { setModalType(null); setSelectedUser(null); }} onSave={handleSave} />
            )}
            {modalType === 'delete' && (
                <DeleteModal user={selectedUser} onClose={() => { setModalType(null); setSelectedUser(null); }} onConfirm={handleDelete} />
            )}
        </div>
    );
}
