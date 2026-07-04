import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const login    = useAuthStore((s) => s.login);

  const [form, setForm]       = useState({ email: '', password: '', displayName: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.register(form);
      login(user, accessToken, refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Zap size={22} color="white" /></div>
          <span className="auth-logo-text">Dev Command Center</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start managing your developer workspace</p>

        {error && (
          <div className="badge badge-danger" style={{ padding: '10px 14px', marginBottom: 16, display: 'block', width: '100%' }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="reg-name">Display Name</label>
            <input
              id="reg-name"
              type="text"
              className="input"
              placeholder="Your name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-email">Email *</label>
            <input
              id="reg-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-password">Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
                type={showPwd ? 'text' : 'password'}
                className="input"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                }}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Strength hint */}
            {form.password && (
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {[8, 12, 16].map((len, i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: form.password.length >= len
                      ? ['var(--accent-danger)', 'var(--accent-warning)', 'var(--accent-success)'][i]
                      : 'var(--border-default)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: '0.95rem' }}
            disabled={loading}
            id="register-submit"
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : (
              <><span>Create Account</span><ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </main>
  );
}
