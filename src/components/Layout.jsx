import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-wrapper">
                <Topbar />
                <main className="content-area">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
