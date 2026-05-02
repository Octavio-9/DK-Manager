import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    FolderOpen,
    Video,
    CheckSquare,
    Users,
    UserCog,
    Settings,
    Building2
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
    const { canAccess } = useAuth();

    // Define the full list of potential nav items mapped to their route IDs
    const allNavItems = [
        { id: 'dashboard', path: '/dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
        { id: 'projects', path: '/projects', label: 'Projets', icon: FolderOpen },
        { id: 'clients', path: '/clients', label: 'Clients', icon: Building2 },
        { id: 'calendar', path: '/calendar', label: 'Tournages', icon: Video },
        { id: 'tasks', path: '/tasks', label: 'Tâches', icon: CheckSquare },
        { id: 'team', path: '/team', label: 'Équipe', icon: Users },
        { id: 'users', path: '/users', label: 'Utilisateurs', icon: UserCog },
    ];

    // Filter items based on user permissions
    const navItems = allNavItems.filter(item => canAccess(item.id));

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo-container">
                    <div className="logo-icon">🎬</div>
                    <div>
                        <h1 className="logo-title">DK Production</h1>
                        <p className="logo-subtitle">Production Manager</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <NavLink to="/settings" className="nav-item">
                    <Settings size={20} />
                    <span>Paramètres</span>
                </NavLink>
            </div>
        </aside>
    );
}
