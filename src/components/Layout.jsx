import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="app-container">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="mobile-overlay" 
                    onClick={closeSidebar}
                />
            )}
            
            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
            
            <div className="main-wrapper">
                <Topbar onMenuClick={toggleSidebar} />
                <main className="content-area">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

