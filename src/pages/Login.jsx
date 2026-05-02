import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Simulate slight async delay for UX feel
        await new Promise(r => setTimeout(r, 600));

        const result = await login(email.trim(), password);
        setLoading(false);

        if (result.success) {
            navigate('/dashboard', { replace: true });
        } else {
            setError(result.error);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        const result = await googleLogin(credentialResponse.credential);
        setLoading(false);
        if (result.success) {
            navigate('/dashboard', { replace: true });
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background orbs */}
            <div className="login-bg">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">🎬</div>
                    <div>
                        <h1 className="login-brand">DK Production</h1>
                        <p className="login-brand-sub">Production Manager</p>
                    </div>
                </div>

                <h2 className="login-title">Connexion</h2>
                <p className="login-subtitle">Accédez à votre espace de gestion</p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {/* Email */}
                    <div className="login-field">
                        <label htmlFor="login-email">Adresse email</label>
                        <div className="input-icon-wrap">
                            <Mail size={16} className="input-icon" />
                            <input
                                id="login-email"
                                type="email"
                                className="login-input"
                                placeholder="vous@dkproduction.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="login-field">
                        <label htmlFor="login-password">Mot de passe</label>
                        <div className="input-icon-wrap">
                            <Lock size={16} className="input-icon" />
                            <input
                                id="login-password"
                                type={showPwd ? 'text' : 'password'}
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="show-pwd-btn"
                                onClick={() => setShowPwd(v => !v)}
                                tabIndex={-1}
                                aria-label={showPwd ? 'Cacher' : 'Afficher'}
                            >
                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="login-error">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? (
                            <span className="login-spinner" />
                        ) : (
                            <>
                                <LogIn size={18} />
                                Se connecter
                            </>
                        )}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--c-border)' }} />
                        <span style={{ padding: '0 10px', color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>OU</span>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--c-border)' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('La connexion Google a échoué.')}
                            theme="outline"
                            text="signin_with"
                            shape="rectangular"
                        />
                    </div>
                </form>

                {/* Go to Signup */}
                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--c-text-muted)' }}>
                    Pas encore de compte ?{' '}
                    <Link to="/signup" style={{ color: 'var(--c-primary)', textDecoration: 'none', fontWeight: '500' }}>
                        S'inscrire
                    </Link>
                </div>
            </div>
        </div>
    );
}
