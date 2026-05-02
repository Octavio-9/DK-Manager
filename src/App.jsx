import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Team from './pages/Team';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import Users from './pages/Users';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import Clients from './pages/Clients';

// ─── Protected Route Wrapper ────────────────────────────────────────────────
function ProtectedRoute({ routeId }) {
    const { user, canAccess } = useAuth();

    if (!user) {
        // Not logged in -> redirect to login
        return <Navigate to="/login" replace />;
    }

    if (routeId && !canAccess(routeId)) {
        // Logged in but no permission for this specific route -> back to dashboard
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

// ─── Main App ─────────────────────────────────────────────────────────────
function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Protected Routes (require session) */}
                    <Route path="/" element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            {/* Base redirect */}
                            <Route index element={<Navigate to="/dashboard" replace />} />

                            {/* Specific permission routes */}
                            <Route element={<ProtectedRoute routeId="dashboard" />}>
                                <Route path="dashboard" element={<Dashboard />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="projects" />}>
                                <Route path="projects" element={<Projects />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="team" />}>
                                <Route path="team" element={<Team />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="calendar" />}>
                                <Route path="calendar" element={<Calendar />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="clients" />}>
                                <Route path="clients" element={<Clients />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="tasks" />}>
                                <Route path="tasks" element={<Tasks />} />
                            </Route>

                            <Route element={<ProtectedRoute routeId="users" />}>
                                <Route path="users" element={<Users />} />
                            </Route>

                            {/* Catch all - fallback to dashboard inside layout */}
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
