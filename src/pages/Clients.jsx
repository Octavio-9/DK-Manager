import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Building2, Phone, Mail, MapPin, MoreVertical, Search, AlertCircle, X, MessageSquare } from 'lucide-react';
import './Clients.css';

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    
    const [formData, setFormData] = useState({
        name: '', company: '', phone: '', whatsapp: '', email: '', 
        address: '', budget: '', notes: '', type: 'ENTREPRISE', status: 'PROSPECT'
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
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.request('/api/clients');
            setClients(data.clients || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingClient(null);
        setFormData({
            name: '', company: '', phone: '', whatsapp: '', email: '', 
            address: '', budget: '', notes: '', type: 'ENTREPRISE', status: 'PROSPECT'
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (client) => {
        setEditingClient(client);
        setFormData({
            name: client.name || '',
            company: client.company || '',
            phone: client.phone || '',
            whatsapp: client.whatsapp || '',
            email: client.email || '',
            address: client.address || '',
            budget: client.budget || '',
            notes: client.notes || '',
            type: client.type || 'ENTREPRISE',
            status: client.status || 'PROSPECT'
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingClient) {
                const updated = await api.request(`/api/clients/${editingClient.id}`, {
                    method: 'PUT',
                    body: formData
                });
                setClients(clients.map(c => c.id === editingClient.id ? updated.client : c));
            } else {
                const created = await api.request('/api/clients', {
                    method: 'POST',
                    body: formData
                });
                setClients([created.client, ...clients]);
            }
            setIsModalOpen(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async () => {
        if (!editingClient) return;
        if (!window.confirm('Voulez-vous vraiment supprimer ce client ?')) return;
        try {
            await api.request(`/api/clients/${editingClient.id}`, { method: 'DELETE' });
            setClients(clients.filter(c => c.id !== editingClient.id));
            setIsModalOpen(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusLabel = (status) => {
        switch(status) {
            case 'PROSPECT': return 'Prospect';
            case 'EN_DISCUSSION': return 'En Discussion';
            case 'ACTIF': return 'Actif';
            case 'FIDELE': return 'Fidèle';
            case 'INACTIF': return 'Inactif';
            default: return status;
        }
    };

    return (
        <div className="clients-page h-full flex flex-col">
            <div className="page-header flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-white mb-2">Gestion des Clients</h1>
                    <p className="text-sm text-secondary">Répertoire centralisé et historique des relations</p>
                </div>

                <div className="flex gap-4">
                    <button className="btn btn-primary shadow-glow" onClick={handleOpenCreate}>
                        <Plus size={18} />
                        <span>Nouveau Client</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                        type="text" 
                        placeholder="Rechercher un client ou une entreprise..." 
                        className="input w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                {loading && <div className="text-center text-muted py-8">Chargement des clients...</div>}
                
                {!loading && filteredClients.length === 0 && (
                    <div className="text-center text-muted py-12 bg-card rounded-xl border border-light">
                        <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Aucun client trouvé.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(client => (
                        <div key={client.id} className="client-card bg-card border border-light rounded-xl p-5 cursor-pointer" onClick={() => handleOpenEdit(client)}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{client.name}</h3>
                                    {client.company && (
                                        <div className="flex items-center text-sm text-purple mt-1 gap-1.5 font-medium">
                                            <Building2 size={14} />
                                            {client.company}
                                        </div>
                                    )}
                                </div>
                                <span className={`status-badge status-${client.status.toLowerCase()}`}>
                                    {getStatusLabel(client.status)}
                                </span>
                            </div>

                            <div className="space-y-2 mb-5">
                                {client.email && (
                                    <div className="flex items-center text-sm text-secondary gap-2">
                                        <Mail size={14} className="text-muted" />
                                        <span className="truncate">{client.email}</span>
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center text-sm text-secondary gap-2">
                                        <Phone size={14} className="text-muted" />
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                                {client.whatsapp && (
                                    <div className="flex items-center text-sm text-secondary gap-2">
                                        <MessageSquare size={14} className="text-green-500" />
                                        <span>{client.whatsapp}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-light pt-4 flex justify-between items-center">
                                <span className="client-type">{client.type}</span>
                                <div className="text-xs text-muted font-medium bg-hover px-2 py-1 rounded">
                                    {client.projects?.length || 0} Projet(s)
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-panel border border-light rounded-xl p-6 w-full max-w-2xl shadow-xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">
                                {editingClient ? 'Modifier le Client' : 'Nouveau Client'}
                            </h2>
                            <button className="btn btn-ghost p-1" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Nom complet *</label>
                                    <input type="text" required className="input w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Jean Dupont" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Entreprise</label>
                                    <input type="text" className="input w-full" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="Ex: LUNA Records" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Email</label>
                                    <input type="email" className="input w-full" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Téléphone</label>
                                    <input type="text" className="input w-full" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">WhatsApp</label>
                                    <input type="text" className="input w-full" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Type de client</label>
                                    <select className="input w-full" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                        <option value="PARTICULIER">Particulier</option>
                                        <option value="ENTREPRENEUR">Entrepreneur</option>
                                        <option value="CREATEUR">Créateur de contenu</option>
                                        <option value="ENTREPRISE">Entreprise</option>
                                        <option value="MARQUE">Marque</option>
                                        <option value="INSTITUTION">Institution</option>
                                        <option value="PARTENAIRE">Partenaire</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1">Statut relation</label>
                                    <select className="input w-full" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                        <option value="PROSPECT">Prospect</option>
                                        <option value="EN_DISCUSSION">En Discussion</option>
                                        <option value="ACTIF">Actif</option>
                                        <option value="FIDELE">Fidèle</option>
                                        <option value="INACTIF">Inactif</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Adresse</label>
                                <input type="text" className="input w-full" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Budget estimé global</label>
                                <input type="text" className="input w-full" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} placeholder="Ex: 50M GNF / an" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Notes internes</label>
                                <textarea className="input w-full" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Informations importantes sur ce client..."></textarea>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-light mt-6">
                                <div>
                                    {editingClient && (
                                        <button type="button" onClick={handleDelete} className="text-red-500 hover:text-red-400 text-sm font-medium px-4 py-2 rounded transition-colors hover:bg-red-500/10">
                                            Supprimer le client
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Annuler</button>
                                    <button type="submit" className="btn btn-primary shadow-glow">
                                        {editingClient ? 'Enregistrer' : 'Créer le client'}
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
