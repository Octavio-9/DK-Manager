import React, { useState, useEffect, useMemo } from 'react';
import { Users, PieChart, Video, Plus, Search, MoreVertical, Loader2, AlertCircle } from 'lucide-react';
import './Team.css';

export default function Team() {
    const [team, setTeam] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Toute l\'équipe');

    const api = useMemo(() => {
        async function request(path) {
            const res = await fetch(path, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
            return data;
        }
        return { request };
    }, []);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [userData, taskData] = await Promise.all([
                    api.request('/api/users'),
                    api.request('/api/tasks')
                ]);
                setTeam(userData.users || []);
                setTasks(taskData.tasks || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [api]);

    const teamStats = useMemo(() => {
        if (!team.length) return [];
        
        const activeProjectsCount = new Set(tasks.map(t => t.projectId).filter(Boolean)).size;
        
        // Calculate average workload (very basic: tasks per person)
        const totalTasks = tasks.filter(t => t.status !== 'DONE').length;
        const avgWorkload = team.length ? Math.round((totalTasks / (team.length * 5)) * 100) : 0;

        return [
            { title: 'Équipe Totale', value: String(team.length), icon: Users, trend: 'Membres actifs', color: 'var(--accent-purple)' },
            { title: 'Charge Moyenne', value: `${Math.min(avgWorkload, 100)}%`, icon: PieChart, type: 'progress', progress: Math.min(avgWorkload, 100), progressColor: '#f59e0b', color: '#f59e0b' },
            { title: 'Projets Actifs', value: String(activeProjectsCount), icon: Video, trend: 'En cours de production', color: 'var(--accent-cyan)' }
        ];
    }, [team, tasks]);

    const processedTeam = useMemo(() => {
        return team.map(member => {
            const memberTasks = tasks.filter(t => t.assigneeId === member.id && t.status !== 'DONE');
            const workload = Math.min(memberTasks.length * 20, 100); // 5 tasks = 100% workload for demo
            
            let workloadColor = '#10b981';
            if (workload > 80) workloadColor = '#ef4444';
            else if (workload > 50) workloadColor = '#f59e0b';

            return {
                ...member,
                workload,
                workloadColor,
                activeTasks: memberTasks.slice(0, 3).map(t => t.title)
            };
        });
    }, [team, tasks]);

    const tabs = ['Toute l\'équipe', 'Admin', 'Manager', 'Operator', 'Viewer'];
    const filteredTeam = processedTeam.filter(member => {
        if (activeTab === 'Toute l\'équipe') return true;
        return member.role.toLowerCase() === activeTab.toLowerCase();
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-purple" size={32} />
            </div>
        );
    }

    return (
        <div className="team-page">
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Gestion de l'Équipe</h1>
                    <p className="text-sm text-muted">Surveiller et coordonner les membres de l'équipe DK Production</p>
                </div>
                <button className="btn btn-primary shadow-glow">
                    <Plus size={18} />
                    <span>Ajouter un talent</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="stats-grid grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {teamStats.map((stat, idx) => (
                    <div key={idx} className="stat-card card flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-xs uppercase tracking-wider text-muted font-bold">{stat.title}</div>
                            <div className="icon-box" style={{ backgroundColor: `${stat.color}22`, color: stat.color, padding: '6px', borderRadius: '6px' }}>
                                <stat.icon size={18} />
                            </div>
                        </div>

                        <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>

                        {stat.type === 'progress' ? (
                            <div className="progress-container w-full bg-hover h-2 rounded-full mt-2">
                                <div className="progress-bar h-full rounded-full" style={{ width: `${stat.progress}%`, backgroundColor: stat.progressColor }}></div>
                            </div>
                        ) : (
                            <div className="text-sm text-secondary">
                                {stat.trend}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="team-controls mb-6 border-b border-light pb-2 overflow-x-auto whitespace-nowrap">
                <div className="flex gap-6 text-sm">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            className={`team-tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="team-grid grid gap-6">
                {filteredTeam.length === 0 ? (
                    <div className="card text-center py-12 text-muted">
                        Aucun membre trouvé dans cette catégorie.
                    </div>
                ) : filteredTeam.map(member => (
                    <div key={member.id} className="member-card card">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="member-avatar flex items-center justify-center text-lg font-bold text-bg-dark" style={{ backgroundColor: member.avatarBg || 'var(--accent-purple)' }}>
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-md font-bold text-white leading-tight">{member.name}</h3>
                                    <div className="text-xs font-bold mt-1 uppercase" style={{ color: 'var(--accent-purple)' }}>{member.role}</div>
                                </div>
                            </div>
                            <button className="btn btn-ghost p-1 text-muted hover-white">
                                <MoreVertical size={18} />
                            </button>
                        </div>

                        <div className="workload-section mt-6 mb-4">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted">Charge de travail (Tâches)</span>
                                <span className="font-bold" style={{ color: member.workloadColor }}>{member.workload}%</span>
                            </div>
                            <div className="progress-container w-full bg-hover h-1.5 rounded-full">
                                <div className="progress-bar h-full rounded-full" style={{ width: `${member.workload}%`, backgroundColor: member.workloadColor }}></div>
                            </div>
                        </div>

                        <div className="projects-section mt-4 pt-4 border-t border-light">
                            <div className="text-xs text-muted mb-3 uppercase tracking-wider">Tâches Récentes</div>
                            <div className="flex flex-wrap gap-2">
                                {member.activeTasks.length > 0 ? member.activeTasks.map((task, i) => (
                                    <span key={i} className="project-pill bg-hover text-secondary text-xs px-2 py-1 rounded border border-light">
                                        {task}
                                    </span>
                                )) : (
                                    <span className="text-xs text-muted italic">Aucune tâche en cours</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
