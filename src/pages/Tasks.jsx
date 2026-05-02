import React, { useState, useEffect, useMemo } from 'react';
import { Plus, MoreVertical, Clock, AlertCircle } from 'lucide-react';
import './Tasks.css';

export default function Tasks() {
    const columns = [
        { id: 'TODO', title: 'À Faire', accent: '#6e6a75' },
        { id: 'IN_PROGRESS', title: 'En Cours', accent: 'var(--accent-purple)' },
        { id: 'REVIEW', title: 'En Révision', accent: '#f59e0b' },
        { id: 'DONE', title: 'Terminé', accent: '#10b981' }
    ];

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentColumn, setCurrentColumn] = useState('TODO');
    const [editingTask, setEditingTask] = useState(null);

    const [formTitle, setFormTitle] = useState('');
    const [formPriority, setFormPriority] = useState('MEDIUM');

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
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.request('/api/tasks');
            setTasks(data.tasks || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNewTask = (columnId = 'TODO') => {
        setEditingTask(null);
        setCurrentColumn(columnId);
        setFormTitle('');
        setFormPriority('MEDIUM');
        setIsModalOpen(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setFormTitle(task.title);
        setFormPriority(task.priority);
        setIsModalOpen(true);
    };

    const handleSaveTask = async (e) => {
        e.preventDefault();
        if (!formTitle || formTitle.trim() === '') return;

        try {
            if (editingTask) {
                const updated = await api.request(`/api/tasks/${editingTask.id}`, {
                    method: 'PUT',
                    body: { title: formTitle.trim(), priority: formPriority }
                });
                setTasks(tasks.map(t => t.id === editingTask.id ? updated.task : t));
            } else {
                const created = await api.request('/api/tasks', {
                    method: 'POST',
                    body: { title: formTitle.trim(), status: currentColumn, priority: formPriority }
                });
                setTasks([created.task, ...tasks]);
            }
            setIsModalOpen(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteTask = async () => {
        if (!editingTask) return;
        try {
            await api.request(`/api/tasks/${editingTask.id}`, { method: 'DELETE' });
            setTasks(tasks.filter(t => t.id !== editingTask.id));
            setIsModalOpen(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const updateTaskStatus = async (task, newStatus) => {
        if (task.status === newStatus) return;
        try {
            setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
            await api.request(`/api/tasks/${task.id}`, {
                method: 'PUT',
                body: { status: newStatus }
            });
        } catch (err) {
            fetchTasks();
            setError(err.message);
        }
    };

    const getTaskCount = (colId) => tasks.filter(t => t.status === colId).length;

    const getPriorityDetails = (priority) => {
        switch (priority) {
            case 'LOW': return { label: 'Basse', color: '#10b981' };
            case 'MEDIUM': return { label: 'Moyenne', color: '#f59e0b' };
            case 'HIGH': return { label: 'Haute', color: '#ef4444' };
            case 'URGENT': return { label: 'Urgente', color: '#9d3bf1' };
            default: return { label: 'Moyenne', color: '#f59e0b' };
        }
    };

    return (
        <div className="tasks-page flex flex-col h-full h-[calc(100vh-120px)]">
            <div className="page-header flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-white mb-2">Gestionnaire de Tâches</h1>
                    <p className="text-sm text-secondary flex items-center gap-2">
                        Vue Kanban pour le suivi des tâches
                    </p>
                </div>

                <div className="flex gap-4">
                    <button className="btn btn-primary shadow-glow" onClick={() => handleNewTask('TODO')}>
                        <Plus size={18} />
                        <span>Nouvelle Tâche</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="kanban-board flex gap-6 overflow-x-auto pb-4 flex-1">
                {columns.map(column => (
                    <div key={column.id} className="kanban-column bg-bg-panel rounded-xl min-w-[320px] max-w-[320px] flex flex-col border border-light"
                         onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-hover'); }}
                         onDragLeave={(e) => { e.currentTarget.classList.remove('bg-hover'); }}
                         onDrop={(e) => {
                             e.preventDefault();
                             e.currentTarget.classList.remove('bg-hover');
                             const taskId = e.dataTransfer.getData('taskId');
                             const task = tasks.find(t => t.id === taskId);
                             if (task) updateTaskStatus(task, column.id);
                         }}
                    >
                        <div className="column-header p-4 flex justify-between items-center border-b border-light" style={{ borderTopWidth: '3px', borderTopStyle: 'solid', borderTopColor: column.accent, borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white leading-none">{column.title}</h3>
                                <span className="count-badge bg-hover text-secondary text-xs px-2 py-0.5 rounded-full font-bold">
                                    {getTaskCount(column.id)}
                                </span>
                            </div>
                            <button className="btn btn-ghost px-1 py-0 text-muted" onClick={() => handleNewTask(column.id)}><Plus size={18} /></button>
                        </div>

                        <div className="column-content p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                            {loading && tasks.length === 0 && <div className="text-center text-sm text-muted py-4">Chargement...</div>}
                            
                            {tasks.filter(t => t.status === column.id).map(task => {
                                const prio = getPriorityDetails(task.priority);
                                return (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                                    className="task-card bg-card p-4 rounded-lg border border-light cursor-pointer hover:border-muted transition-colors"
                                    onClick={() => handleEditTask(task)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                                            style={{ backgroundColor: `${prio.color}22`, color: prio.color }}
                                        >
                                            {prio.label}
                                        </span>
                                        <button className="text-muted hover:text-white"><MoreVertical size={16} /></button>
                                    </div>

                                    <h4 className="font-bold text-white text-sm mb-1">{task.title}</h4>
                                    <div className="text-xs text-muted mb-4">{task.project?.title || 'Projet Général'}</div>

                                    <div className="flex justify-between items-center border-t border-light pt-3 mt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center text-xs text-muted gap-1">
                                                <Clock size={12} />
                                                <span className={task.dueDate && new Date(task.dueDate) < new Date() ? "text-amber" : ""}>
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'À planifier'}
                                                </span>
                                            </div>
                                        </div>

                                        {task.assignee && (
                                            <div className="avatar micro text-bg-dark text-xs" style={{ backgroundColor: task.assignee.avatarBg || '#6e6a75' }}>
                                                {task.assignee.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        {!task.assignee && (
                                            <div className="avatar micro text-bg-dark text-xs bg-muted">?</div>
                                        )}
                                    </div>
                                </div>
                            )})}

                            <button onClick={() => handleNewTask(column.id)} className="add-task-btn text-muted text-sm w-full py-2 hover-bg-light transition-colors rounded border-dashed border border-transparent hover:border-muted flex items-center justify-center gap-2 mt-2">
                                <Plus size={16} /> Ajouter une tâche
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
                    <div className="bg-panel border border-light rounded-xl p-6 w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--bg-panel)' }}>
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingTask ? 'Modifier la Tâche' : 'Nouvelle Tâche'}
                        </h2>
                        <form onSubmit={handleSaveTask}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary mb-2">Titre de la tâche</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full bg-dark border border-light text-white px-4 py-3 rounded-lg focus:outline-none focus:border-purple"
                                    style={{ backgroundColor: 'var(--bg-dark)', outline: 'none' }}
                                    placeholder="Ex: Montage vidéo TikTok"
                                    autoFocus
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-secondary mb-2">Priorité</label>
                                <select 
                                    className="w-full bg-dark border border-light text-white px-4 py-3 rounded-lg focus:outline-none focus:border-purple appearance-none"
                                    style={{ backgroundColor: 'var(--bg-dark)', outline: 'none' }}
                                    value={formPriority}
                                    onChange={(e) => setFormPriority(e.target.value)}
                                >
                                    <option value="LOW">Basse</option>
                                    <option value="MEDIUM">Moyenne</option>
                                    <option value="HIGH">Haute</option>
                                    <option value="URGENT">Urgente</option>
                                </select>
                            </div>

                            <div className="flex justify-between items-center mt-6">
                                <div>
                                    {editingTask && (
                                        <button type="button" onClick={handleDeleteTask} className="px-4 py-2 rounded-lg transition-colors hover-bg-light font-medium" style={{ color: '#ef4444' }}>
                                            Supprimer
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-lg text-secondary hover-white transition-colors bg-hover">Annuler</button>
                                    <button type="submit" className="btn btn-primary shadow-glow px-5 py-2 rounded-lg">
                                        {editingTask ? 'Enregistrer' : 'Créer Tâche'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
