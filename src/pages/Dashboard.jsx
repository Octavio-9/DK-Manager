import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, Clapperboard, CheckCircle, Bell, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
    const [data, setData] = useState({ stats: null, recentProjects: [], upcomingEvents: [] });
    const [loading, setLoading] = useState(true);

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
            try {
                const res = await api.request('/api/dashboard');
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [api]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-purple mb-4" size={32} />
            </div>
        );
    }

    const { stats, recentProjects, upcomingEvents } = data;

    const summaryCards = [
        {
            title: 'Projets Actifs',
            value: stats?.activeProjects || 0,
            subtitle: 'En cours ou planifiés',
            icon: Briefcase,
            trend: 'Vivant',
            trendColor: '#10b981',
            bgColor: 'rgba(157, 59, 241, 0.15)' /* accent-purple */
        },
        {
            title: 'Événements cette Semaine',
            value: stats?.eventsThisWeek || 0,
            subtitle: 'Tournages, réunions...',
            icon: Clapperboard,
            trend: 'Régulier',
            trendColor: '#a19ea8',
            bgColor: 'rgba(34, 211, 238, 0.15)' /* accent-cyan */
        },
        {
            title: 'Tâches En Cours',
            value: stats?.tasksToday || 0,
            subtitle: 'Non terminées',
            icon: CheckCircle,
            trend: 'À faire',
            trendColor: '#ef4444',
            bgColor: 'rgba(16, 185, 129, 0.15)' /* green */
        },
        {
            title: 'Notifications',
            value: stats?.notifications || 0,
            subtitle: 'Aucune nouvelle alerte',
            icon: Bell,
            trend: 'Calme',
            trendColor: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)' /* amber */
        }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'PLANNING': return 'planning';
            case 'EDITING': return 'editing';
            case 'REVIEW': return 'review';
            case 'DELIVERED': return 'delivered';
            default: return 'planning';
        }
    };
    
    const getStatusLabel = (status) => {
        switch (status) {
            case 'PLANNING': return 'Planification';
            case 'EDITING': return 'Montage';
            case 'REVIEW': return 'En Revue';
            case 'DELIVERED': return 'Livré';
            default: return status;
        }
    };

    const getEventColor = (type) => {
        switch (type) {
            case 'Tournage': return '#3b82f6';
            case 'Podcasts': return '#9d3bf1';
            case 'Réunions Client': return '#10b981';
            case 'Post-Production': return '#f59e0b';
            default: return '#6e6a75';
        }
    };

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    return (
        <div className="dashboard">
            <div className="summary-grid">
                {summaryCards.map((card, idx) => (
                    <div key={idx} className="summary-card card">
                        <div className="card-header flex justify-between items-center mb-4">
                            <div className="icon-wrapper" style={{
                                backgroundColor: card.bgColor,
                                width: '40px', height: '40px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: idx === 0 ? 'var(--accent-purple)' : idx === 1 ? 'var(--accent-cyan)' : idx === 2 ? '#10b981' : '#f59e0b'
                            }}>
                                <card.icon size={20} />
                            </div>
                            <span className="trend-badge" style={{ color: card.trendColor, fontSize: '12px', fontWeight: '500' }}>{card.trend}</span>
                        </div>

                        <h3 className="card-title text-muted mb-1">{card.title}</h3>
                        <div className="card-value text-xl font-bold mb-1">{card.value}</div>
                        <p className="card-subtitle text-xs text-muted">{card.subtitle}</p>
                    </div>
                ))}
            </div>

            <div className="dashboard-content-grid">
                <div className="projects-section card">
                    <div className="section-header flex justify-between items-center mb-4">
                        <h2 className="section-title text-lg font-bold">Projets Récents</h2>
                        <Link to="/projects" className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-purple)' }}>Voir tout</Link>
                    </div>

                    <table className="projects-table w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted text-xs uppercase tracking-wider border-b border-light pb-2">
                                <th className="font-semibold pb-3">NOM DU PROJET</th>
                                <th className="font-semibold pb-3">CLIENT</th>
                                <th className="font-semibold pb-3">STATUT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-4 text-secondary text-sm">Aucun projet récent.</td>
                                </tr>
                            ) : recentProjects.map((project) => (
                                <tr key={project.id} className="border-b border-light last:border-0">
                                    <td className="py-4">
                                        <div className="font-medium text-white">{project.name}</div>
                                        {project.deadline && <div className="text-xs text-muted mt-1">Échéance {new Date(project.deadline).toLocaleDateString('fr-FR')}</div>}
                                    </td>
                                    <td className="py-4 text-sm text-secondary">{project.clientRel?.name || '---'}</td>
                                    <td className="py-4">
                                        <span className={`status-badge status-${getStatusColor(project.status)}`}>
                                            {getStatusLabel(project.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="shoots-section card">
                    <div className="section-header flex justify-between items-center mb-4">
                        <h2 className="section-title text-lg font-bold">Événements à Venir</h2>
                        <Link to="/calendar" className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-purple)' }}>Calendrier</Link>
                    </div>
                    
                    {upcomingEvents.length === 0 ? (
                        <div className="text-secondary text-sm mt-4">Aucun événement planifié pour le moment.</div>
                    ) : (
                        <div className="shoots-timeline pl-2 border-l border-light ml-2 mt-4 space-y-6 relative">
                            {upcomingEvents.map(ev => {
                                const d = new Date(ev.date);
                                const isToday = d.toDateString() === new Date().toDateString();
                                const color = getEventColor(ev.type);
                                return (
                                    <div key={ev.id} className="timeline-item relative">
                                        <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-bg-panel" style={{ backgroundColor: color }}></div>
                                        <div className="timeline-content pl-4">
                                            <div className="text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: isToday ? 'white' : 'var(--c-text-secondary)' }}>
                                                {isToday ? "AUJOURD'HUI" : `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`}
                                            </div>
                                            <div className="font-medium text-white mb-1">{ev.title}</div>
                                            <div className="text-xs text-muted flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                                                {ev.type} {ev.location && `• ${ev.location}`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
