import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, UserPlus, User } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Signup() {
    const { register, googleLogin } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const role = 'viewer'; // Default fixed role for new users
    
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password !== confirmPwd) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        setLoading(true);

        // Simulate slight async delay for UX feel
        await new Promise(r => setTimeout(r, 600));

        const result = await register(name.trim(), email.trim(), password, role);
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

            <div className="login-card" style={{ maxWidth: '450px' }}>
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">🎬</div>
                    <div>
                        <h1 className="login-brand">DK Production</h1>
                        <p className="login-brand-sub">Créer un compte</p>
                    </div>
                </div>

                <h2 className="login-title">Inscription</h2>
                <p className="login-subtitle">Rejoignez l'espace de gestion</p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    
                    {/* Name */}
                    <div className="login-field">
                        <label htmlFor="signup-name">Nom complet</label>
                        <div className="input-icon-wrap">
                            <User size={16} className="input-icon" />
                            <input
                                id="signup-name"
                                type="text"
                                className="login-input"
                                placeholder="Jean Dupont"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="login-field">
                        <label htmlFor="signup-email">Adresse email</label>
                        <div className="input-icon-wrap">
                            <Mail size={16} className="input-icon" />
                            <input
                                id="signup-email"
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
                        <label htmlFor="signup-password">Mot de passe</label>
                        <div className="input-icon-wrap">
                            <Lock size={16} className="input-icon" />
                            <input
                                id="signup-password"
                                type={showPwd ? 'text' : 'password'}
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="new-password"
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

                    {/* Confirm Password */}
                    <div className="login-field">
                        <label htmlFor="signup-confirm-password">Confirmer le mot de passe</label>
                        <div className="input-icon-wrap">
                            <Lock size={16} className="input-icon" />
                            <input
                                id="signup-confirm-password"
                                type={showConfirmPwd ? 'text' : 'password'}
                                className="login-input"
                                placeholder="••••••••"
                                value={confirmPwd}
                                onChange={e => setConfirmPwd(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="show-pwd-btn"
                                onClick={() => setShowConfirmPwd(v => !v)}
                                tabIndex={-1}
                                aria-label={showConfirmPwd ? 'Cacher' : 'Afficher'}
                            >
                                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? (
                            <span className="login-spinner" />
                        ) : (
                            <>
                                <UserPlus size={18} />
                                S'inscrire
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
                            text="signup_with"
                            shape="rectangular"
                        />
                    </div>
                </form>

                {/* Back to Login */}
                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--c-text-muted)' }}>
                    Déjà un compte ?{' '}
                    <Link to="/login" style={{ color: 'var(--c-primary)', textDecoration: 'none', fontWeight: '500' }}>
                        Se connecter
                    </Link>
                </div>
            </div>
        </div>
    );
}
