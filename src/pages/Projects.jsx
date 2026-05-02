import React, { useEffect, useMemo, useState } from 'react';
import { MoreVertical, Plus, Clock, CheckCircle, Users, AlertTriangle, Clapperboard, X, Edit, Trash2 } from 'lucide-react';
import './Projects.css';

export default function Projects() {
    const [activeTab, setActiveTab] = useState('Tous les projets');
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [createForm, setCreateForm] = useState({
        title: '',
        client: '',
        clientId: '',
        status: 'PLANNING',
        deadline: '',
        description: '',
    });

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
            setLoading(true);
            setError('');
            try {
                const [projData, clientData] = await Promise.all([
                    api.request('/api/projects'),
                    api.request('/api/clients')
                ]);
                if (!cancelled) {
                    setProjects(projData.projects ?? []);
                    setClients(clientData.clients ?? []);
                }
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Erreur serveur');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [api]);

    function statusLabel(status) {
        switch (status) {
            case 'PLANNING': return 'PLANIFICATION';
            case 'FILMING': return 'TOURNAGE';
            case 'EDITING': return 'MONTAGE';
            case 'DELIVERED': return 'LIVRÉ';
            default: return status;
        }
    }

    function statusClass(status) {
        switch (status) {
            case 'PLANNING': return 'planning';
            case 'FILMING': return 'filming';
            case 'EDITING': return 'editing';
            case 'DELIVERED': return 'delivered';
            default: return 'planning';
        }
    }

    function statusIconColor(status) {
        switch (status) {
            case 'PLANNING': return '#f59e0b';
            case 'EDITING': return '#3b82f6';
            case 'FILMING': return '#ef4444';
            case 'DELIVERED': return '#10b981';
            default: return '#a19ea8';
        }
    }

    const metrics = useMemo(() => {
        const counts = projects.reduce((acc, p) => {
            acc.total += 1;
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, { total: 0 });

        return [
            { title: 'En Cours', value: String((counts.PLANNING || 0) + (counts.FILMING || 0) + (counts.EDITING || 0)), icon: Clock, color: 'var(--accent-cyan)' },
            { title: 'Terminés', value: String(counts.DELIVERED || 0), icon: CheckCircle, color: '#10b981' },
            { title: 'Total', value: String(counts.total || 0), icon: Users, color: 'var(--accent-purple)' },
            { title: 'Critique', value: '—', icon: AlertTriangle, color: '#ef4444' }
        ];
    }, [projects]);

    const tabs = ['Tous les projets', 'Planification', 'Tournage', 'Montage', 'Livré'];
    const filteredProjects = useMemo(() => {
        if (activeTab === 'Tous les projets') return projects;
        const wanted = activeTab === 'Planification' ? 'PLANNING'
            : activeTab === 'Tournage' ? 'FILMING'
                : activeTab === 'Montage' ? 'EDITING'
                    : activeTab === 'Livré' ? 'DELIVERED'
                        : null;
        return wanted ? projects.filter(p => p.status === wanted) : projects;
    }, [activeTab, projects]);

    const openCreate = () => {
        setCreateForm({ title: '', client: '', clientId: '', status: 'PLANNING', deadline: '', description: '' });
        setIsEdit(false);
        setSelectedId(null);
        setError('');
        setIsCreateOpen(true);
    };

    const openEdit = (project) => {
        setCreateForm({
            title: project.title,
            client: project.client || '',
            clientId: project.clientId || '',
            status: project.status,
            deadline: project.deadline ? project.deadline.slice(0, 10) : '',
            description: project.description || '',
        });
        setIsEdit(true);
        setSelectedId(project.id);
        setError('');
        setIsCreateOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Voulez-vous vraiment supprimer ce projet ?")) return;
        try {
            await api.request(`/api/projects/${id}`, { method: 'DELETE' });
            setProjects(projects.filter(p => p.id !== id));
        } catch (e) {
            alert(e.message || "Erreur lors de la suppression");
        }
    };

    const submitCreate = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const payload = {
                title: createForm.title.trim(),
                client: createForm.client.trim(),
                clientId: createForm.clientId || null,
                status: createForm.status,
                deadline: createForm.deadline ? createForm.deadline : null,
                description: createForm.description?.trim() ? createForm.description.trim() : null,
            };
            if (isEdit) {
                const data = await api.request(`/api/projects/${selectedId}`, { method: 'PUT', body: payload });
                setProjects(projects.map(p => p.id === selectedId ? data.project : p));
            } else {
                const data = await api.request('/api/projects', { method: 'POST', body: payload });
                setProjects([data.project, ...projects]);
            }
            setIsCreateOpen(false);
        } catch (e2) {
            setError(e2?.message || 'Erreur serveur');
        }
    };

    return (
        <div className="projects-page">
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Gestion des Projets</h1>
                    <p className="text-sm text-muted">Gérer et suivre le pipeline de production pour tous les projets vidéo actifs</p>
                </div>
                <button className="btn btn-primary shadow-glow" onClick={openCreate}>
                    <Plus size={18} />
                    <span>Nouveau Projet</span>
                </button>
            </div>

            <div className="projects-controls flex justify-between items-center mb-6">
                <div className="tabs-container flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 text-sm text-secondary">
                    <span>Trier par: <strong className="text-white ml-1">Échéance ↑</strong></span>
                </div>
            </div>

            {error && (
                <div className="card mb-6" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
                    <div className="text-sm" style={{ color: '#ef4444', fontWeight: 600 }}>Erreur</div>
                    <div className="text-sm text-secondary mt-1">{error}</div>
                </div>
            )}

            <div className="card max-w-full overflow-x-auto mb-8 p-0">
                <table className="projects-table-full w-full text-left border-collapse">
                    <thead>
                        <tr className="text-muted text-xs uppercase tracking-wider border-b border-light bg-hover">
                            <th className="font-semibold py-4 px-6">TITRE DU PROJET</th>
                            <th className="font-semibold py-4 px-4">CLIENT</th>
                            <th className="font-semibold py-4 px-4 text-center">STATUT</th>
                            <th className="font-semibold py-4 px-4">ÉCHÉANCE</th>
                            <th className="font-semibold py-4 px-4">DESCRIPTION</th>
                            <th className="py-4 px-4 text-right">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td className="py-4 px-6 text-secondary" colSpan={6}>Chargement…</td>
                            </tr>
                        ) : filteredProjects.length === 0 ? (
                            <tr>
                                <td className="py-4 px-6 text-secondary" colSpan={6}>Aucun projet.</td>
                            </tr>
                        ) : filteredProjects.map((project) => (
                            <tr key={project.id} className="border-b border-light hover-row transition-colors group">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="project-icon bg-hover text-white flex items-center justify-center rounded-lg w-10 h-10">
                                            <Clapperboard size={18} color={statusIconColor(project.status)} />
                                        </div>
                                        <div className="font-semibold text-white">{project.title}</div>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-sm text-secondary">{project.clientRel?.name || project.client || '—'}</td>
                                <td className="py-4 px-4 text-center">
                                    <span className={`status-badge status-${statusClass(project.status)}`}>
                                        {statusLabel(project.status)}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    {project.deadline ? (
                                        <div className="text-sm text-white font-medium">
                                            {new Date(project.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted">—</div>
                                    )}
                                </td>
                                <td className="py-4 px-4 text-sm text-secondary italic truncate max-w-xs block-truncate">
                                    {project.description || '—'}
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="btn btn-ghost px-2 text-muted hover:text-white" onClick={() => openEdit(project)}>
                                            <Edit size={16} />
                                        </button>
                                        <button className="btn btn-ghost px-2 text-muted hover:text-red-400" onClick={() => handleDelete(project.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="metrics-row grid grid-cols-4 gap-6">
                {metrics.map((metric, idx) => (
                    <div key={idx} className="metric-card card flex items-center justify-between p-5">
                        <div>
                            <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2 flex items-center gap-2">
                                <metric.icon size={16} color={metric.color} />
                                {metric.title}
                            </div>
                            <div className="text-3xl font-bold text-white">{metric.value}</div>
                        </div>
                        <div className="metric-icon-bg" style={{ backgroundColor: `${metric.color}22` }}>
                            <metric.icon size={32} color={metric.color} style={{ opacity: 0.8 }} />
                        </div>
                    </div>
                ))}
            </div>

            {isCreateOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                    onClick={(e) => e.target === e.currentTarget && setIsCreateOpen(false)}
                >
                    <div className="bg-panel border border-light rounded-xl p-6 w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--bg-panel)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">{isEdit ? 'Modifier le projet' : 'Nouveau Projet'}</h2>
                            <button className="btn btn-ghost p-1" onClick={() => setIsCreateOpen(false)} aria-label="Fermer">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={submitCreate}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary mb-2">Titre</label>
                                <input
                                    className="input w-full"
                                    value={createForm.title}
                                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                                    placeholder="Ex: Clip musical"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary mb-2">Client</label>
                                <select
                                    className="input w-full mb-2"
                                    value={createForm.clientId}
                                    onChange={(e) => {
                                        setCreateForm({ ...createForm, clientId: e.target.value, client: '' });
                                    }}
                                >
                                    <option value="">-- Sélectionner un client --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <input
                                    className="input w-full text-sm"
                                    value={createForm.client}
                                    onChange={(e) => setCreateForm({ ...createForm, client: e.target.value, clientId: '' })}
                                    placeholder="Ou saisir un client externe..."
                                    disabled={!!createForm.clientId}
                                />
                            </div>

                            <div className="mb-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Statut</label>
                                    <select
                                        className="input w-full"
                                        value={createForm.status}
                                        onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                                    >
                                        <option value="PLANNING">Planification</option>
                                        <option value="FILMING">Tournage</option>
                                        <option value="EDITING">Montage</option>
                                        <option value="DELIVERED">Livré</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Échéance</label>
                                    <input
                                        type="date"
                                        className="input w-full"
                                        value={createForm.deadline}
                                        onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-secondary mb-2">Description</label>
                                <textarea
                                    className="input w-full"
                                    rows={3}
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    placeholder="Optionnel"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" className="btn btn-ghost" onClick={() => setIsCreateOpen(false)}>Annuler</button>
                                <button type="submit" className="btn btn-primary shadow-glow">{isEdit ? 'Enregistrer' : 'Créer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
