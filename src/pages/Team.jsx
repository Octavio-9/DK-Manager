import React, { useState } from 'react';
import { Users, PieChart, Video, Plus, Search, MoreVertical } from 'lucide-react';
import './Team.css';

export default function Team() {
    const [activeTab, setActiveTab] = useState('Toute l\'équipe');

    const stats = [
        { title: 'Équipe Totale', value: '24', icon: Users, trend: '+2 ce mois', color: 'var(--accent-purple)' },
        { title: 'Charge Moyenne', value: '68%', icon: PieChart, type: 'progress', progress: 68, progressColor: '#f59e0b', color: '#f59e0b' },
        { title: 'Projets Actifs', value: '12', icon: Video, trend: '4 Projets dus cette semaine', color: 'var(--accent-cyan)' }
    ];

    const team = [
        {
            id: 1, name: 'Alex Rivera', role: 'VIDÉASTE PRINCIPAL',
            workload: 85, workloadColor: '#f59e0b',
            projects: ['Nike Spring \'24', 'Urban Beats Doc', 'Tesla Ad'],
            avatarBg: '#22d3ee'
        },
        {
            id: 2, name: 'Sarah Chen', role: 'MONTEUSE SÉNIOR',
            workload: 45, workloadColor: '#10b981',
            projects: ['Pepsi Campaign', 'Spotify Wrapped'],
            avatarBg: '#9d3bf1'
        },
        {
            id: 3, name: 'Jordan Smith', role: 'MOTION DESIGNER',
            workload: 98, workloadColor: '#ef4444',
            projects: ['Meta Rebrand', 'E3 Cinematic', 'Adobe Promo', 'Samsung Global'],
            avatarBg: '#f59e0b'
        },
        {
            id: 4, name: 'Elena Vasquez', role: 'ÉTALONNEUSE',
            workload: 30, workloadColor: '#10b981',
            projects: ['Music Video: \'Neon\''],
            avatarBg: '#ef4444'
        },
        {
            id: 5, name: 'Marcus Thompson', role: 'SOUND DESIGNER',
            workload: 72, workloadColor: '#f59e0b',
            projects: ['Short Film: \'The Echo\'', 'Sound Library V2'],
            avatarBg: '#10b981'
        },
        {
            id: 6, name: 'Maya Patil', role: 'VIDÉASTE',
            workload: 55, workloadColor: '#10b981',
            projects: ['Fashion Week Paris', 'Vogue Feature'],
            avatarBg: '#3b82f6'
        }
    ];

    const tabs = ['Toute l\'équipe', 'Vidéastes', 'Monteurs', 'Motion Designers', 'Ingénieurs Son'];

    return (
        <div className="team-page">
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Gestion de l'Équipe</h1>
                    <p className="text-sm text-muted">Surveiller et assigner 24 membres d'équipe sur les productions actives</p>
                </div>
                <button className="btn btn-primary shadow-glow">
                    <Plus size={18} />
                    <span>Ajouter un talent</span>
                </button>
            </div>

            <div className="stats-grid grid grid-cols-3 gap-6 mb-8">
                {stats.map((stat, idx) => (
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
                            <div className="text-sm" style={{ color: stat.color === 'var(--accent-cyan)' ? 'var(--text-muted)' : '#10b981' }}>
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
                {team.map(member => (
                    <div key={member.id} className="member-card card">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="member-avatar flex items-center justify-center text-lg font-bold text-bg-dark" style={{ backgroundColor: member.avatarBg }}>
                                    {member.name.charAt(0)}
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
                                <span className="text-muted">Charge actuelle</span>
                                <span className="font-bold" style={{ color: member.workloadColor }}>{member.workload}%</span>
                            </div>
                            <div className="progress-container w-full bg-hover h-1.5 rounded-full">
                                <div className="progress-bar h-full rounded-full" style={{ width: `${member.workload}%`, backgroundColor: member.workloadColor }}></div>
                            </div>
                        </div>

                        <div className="projects-section mt-4 pt-4 border-t border-light">
                            <div className="text-xs text-muted mb-3 uppercase tracking-wider">Projets Actifs</div>
                            <div className="flex flex-wrap gap-2">
                                {member.projects.map((project, i) => (
                                    <span key={i} className="project-pill bg-hover text-secondary text-xs px-2 py-1 rounded border border-light">
                                        {project}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pagination-footer mt-8 flex justify-center items-center text-sm text-muted">
                <div className="flex gap-2">
                    <button className="page-btn bg-hover text-muted">&lt;</button>
                    <button className="page-btn bg-purple text-white border-0">1</button>
                    <button className="page-btn bg-hover text-white">2</button>
                    <button className="page-btn bg-hover text-white">3</button>
                    <button className="page-btn bg-hover text-muted">&gt;</button>
                </div>
            </div>
        </div>
    );
}
