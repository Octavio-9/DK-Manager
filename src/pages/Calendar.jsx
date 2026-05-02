import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Plus, ChevronRight, X, Calendar as CalIcon, MapPin, AlignLeft } from 'lucide-react';
import './Calendar.css';

const eventTypes = [
    { label: 'Tournage', color: '#3b82f6' },
    { label: 'Podcasts', color: '#9d3bf1' },
    { label: 'Réunions Client', color: '#10b981' },
    { label: 'Post-Production', color: '#f59e0b' }
];

function getEventColor(type) {
    const eventType = eventTypes.find(et => et.label === type);
    return eventType ? eventType.color : '#6e6a75';
}

function EventModal({ event, onClose, onSave }) {
    const [form, setForm] = useState(
        event
            ? { title: event.title, type: event.type, date: event.date.slice(0, 10), location: event.location || '', notes: event.notes || '' }
            : { title: '', type: 'Tournage', date: new Date().toISOString().slice(0, 10), location: '', notes: '' }
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.date) return;
        onSave(form);
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2>{event ? 'Modifier l\'événement' : 'Nouvel événement'}</h2>
                    <button className="btn btn-ghost p-1" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>Titre</label>
                        <input className="input" placeholder="Ex: Studio Shoot: Plan A" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Date</label>
                        <div className="input-icon-wrap">
                            <CalIcon size={16} className="input-icon" />
                            <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Type d'événement</label>
                        <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            {eventTypes.map(t => (
                                <option key={t.label} value={t.label}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Lieu (optionnel)</label>
                        <div className="input-icon-wrap">
                            <MapPin size={16} className="input-icon" />
                            <input className="input" placeholder="Ex: Studio Principal" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Notes (optionnel)</label>
                        <div className="input-icon-wrap" style={{ alignItems: 'flex-start', paddingTop: '10px' }}>
                            <AlignLeft size={16} className="input-icon" style={{ top: '12px', transform: 'none' }} />
                            <textarea className="input" placeholder="Détails de l'événement..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="3" style={{ paddingLeft: '40px' }}></textarea>
                        </div>
                    </div>
                    <div className="modal-actions mt-6">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary shadow-glow">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Calendar() {
    const [view, setView] = useState('Mois');
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

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
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const data = await api.request('/api/events');
            setEvents(data.events || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEvent = async (form) => {
        try {
            if (selectedEvent) {
                const updated = await api.request(`/api/events/${selectedEvent.id}`, { method: 'PUT', body: form });
                setEvents(events.map(e => e.id === selectedEvent.id ? updated.event : e));
            } else {
                const created = await api.request('/api/events', { method: 'POST', body: form });
                setEvents([...events, created.event]);
            }
            setModalOpen(false);
            setSelectedEvent(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteEvent = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Supprimer cet événement ?")) return;
        try {
            await api.request(`/api/events/${id}`, { method: 'DELETE' });
            setEvents(events.filter(ev => ev.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    
    // Generate dates for the current month
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const generateDates = () => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        
        let dates = [];
        
        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            dates.push({ day: prevMonthDays - i, current: false, dateStr: new Date(currentYear, currentMonth - 1, prevMonthDays - i).toISOString().slice(0, 10) });
        }
        
        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(currentYear, currentMonth, i + 1).toISOString().slice(0, 10);
            const dayEvents = events.filter(e => e.date.startsWith(dateStr));
            dates.push({ day: i, current: true, dateStr, events: dayEvents });
        }
        
        // Next month days to complete grid
        const remaining = 42 - dates.length; // 6 rows of 7
        for (let i = 1; i <= remaining; i++) {
            dates.push({ day: i, current: false, dateStr: new Date(currentYear, currentMonth + 1, i + 1).toISOString().slice(0, 10) });
        }
        return dates;
    };

    const calendarDates = generateDates();
    
    // Prochains événements (dans le futur, limités à 3)
    const upcomingEvents = [...events].filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0)).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 3);

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    return (
        <div className="calendar-page">
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-2">Planning de Production</h1>
                    <div className="text-sm text-secondary flex items-center gap-2">
                        <CalendarIcon size={16} />
                        {monthNames[currentMonth]} {currentYear}
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="view-toggle flex bg-panel rounded-lg p-1 border border-light">
                        {['Mois', 'Semaine', 'Jour'].map(v => (
                            <button
                                key={v}
                                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${view === v ? 'bg-purple text-white font-medium' : 'text-secondary hover-white'}`}
                                onClick={() => setView(v)}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-primary shadow-glow" onClick={() => { setSelectedEvent(null); setModalOpen(true); }}>
                        <Plus size={18} />
                        <span>Planifier Événement</span>
                    </button>
                </div>
            </div>

            <div className="event-filters flex gap-4 mb-6">
                {eventTypes.map((type, i) => (
                    <div key={i} className="filter-pill flex items-center gap-2 px-3 py-1.5 rounded-full border border-light bg-hover text-sm">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }}></div>
                        <span className="text-secondary tracking-wide">{type.label}</span>
                    </div>
                ))}
            </div>

            <div className="calendar-grid card p-0 overflow-hidden mb-8 border border-light">
                <div className="calendar-header grid grid-cols-7 border-b border-light">
                    {days.map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold text-muted uppercase tracking-wider">{day}</div>
                    ))}
                </div>
                <div className="calendar-body grid grid-cols-7 border-l-0">
                    {calendarDates.map((dateObj, i) => (
                        <div
                            key={i}
                            className={`calendar-cell border-b border-light border-r p-2 min-h-[140px] ${!dateObj.current ? 'bg-[#15131a] opacity-50' : 'bg-bg-panel hover:bg-hover'} transition-colors ${dateObj.dateStr === new Date().toISOString().slice(0,10) ? 'bg-[rgba(157,59,241,0.05)]' : ''}`}
                            style={{ borderRightColor: 'rgba(255, 255, 255, 0.05)' }}
                            onClick={() => {
                                if (dateObj.current) {
                                    setSelectedEvent(null);
                                    setModalOpen(true);
                                }
                            }}
                        >
                            <div className={`text-sm mb-2 px-1 ${dateObj.dateStr === new Date().toISOString().slice(0,10) ? 'text-purple font-bold' : 'text-secondary font-medium'}`}>
                                {dateObj.day}
                            </div>
                            <div className="events-container flex flex-col gap-1.5">
                                {dateObj.events && dateObj.events.map((ev, ei) => (
                                    <div
                                        key={ei}
                                        className="event-capsule text-xs px-2 py-1.5 rounded truncate text-white border flex justify-between items-center cursor-pointer hover:opacity-80"
                                        style={{
                                            backgroundColor: `${getEventColor(ev.type)}33`,
                                            borderColor: `${getEventColor(ev.type)}66`,
                                            borderLeftWidth: '3px',
                                            borderLeftColor: getEventColor(ev.type)
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setModalOpen(true); }}
                                    >
                                        <span className="truncate">{ev.title}</span>
                                        <button className="text-secondary hover:text-red-400 p-0.5 ml-1" onClick={(e) => handleDeleteEvent(ev.id, e)}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="dashboard-content-grid">
                <div className="card">
                    <h2 className="section-title text-lg font-bold mb-4">Prochains Événements</h2>
                    <div className="space-y-4">
                        {upcomingEvents.length === 0 ? (
                            <div className="text-secondary text-sm">Aucun événement à venir.</div>
                        ) : upcomingEvents.map(ev => (
                            <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-hover transition-colors cursor-pointer border border-transparent hover:border-light" onClick={() => { setSelectedEvent(ev); setModalOpen(true); }}>
                                <div className="flex items-start gap-4">
                                    <div className="date-block text-center bg-hover rounded-lg p-2 min-w-[50px]">
                                        <div className="text-[10px] font-bold uppercase" style={{ color: getEventColor(ev.type) }}>
                                            {monthNames[new Date(ev.date).getMonth()].slice(0,3)}
                                        </div>
                                        <div className="text-lg font-bold text-white leading-none mt-1">
                                            {new Date(ev.date).getDate()}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{ev.title}</h4>
                                        <div className="text-sm text-secondary mt-1 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getEventColor(ev.type) }} />
                                            {ev.type} {ev.location && `• ${ev.location}`}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-muted" size={20} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 className="section-title text-lg font-bold mb-4">Statut des Ressources</h2>
                    <div className="space-y-6 mt-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-secondary font-medium">Disponibilité Studio A</span>
                                <span className="text-purple font-bold">45%</span>
                            </div>
                            <div className="w-full bg-hover h-2 rounded-full">
                                <div className="bg-purple h-full rounded-full" style={{ width: '45%' }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-secondary font-medium">Charge Équipe Caméra</span>
                                <span className="text-green font-bold">82%</span>
                            </div>
                            <div className="w-full bg-hover h-2 rounded-full">
                                <div className="bg-green h-full rounded-full" style={{ width: '82%' }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-secondary font-medium">File Attente Rendu Post-Prod</span>
                                <span className="text-blue font-bold">12%</span>
                            </div>
                            <div className="w-full bg-hover h-2 rounded-full">
                                <div className="bg-[#3b82f6] h-full rounded-full" style={{ width: '12%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {modalOpen && <EventModal event={selectedEvent} onClose={() => setModalOpen(false)} onSave={handleSaveEvent} />}
        </div>
    );
}
