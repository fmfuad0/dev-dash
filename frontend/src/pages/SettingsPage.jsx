import React from 'react';
import { Settings, User, Lock, Bell, Zap, ChevronRight, Shield, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

function SettingSection({ title, children }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-header">
        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{title}</span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, right, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.background = 'var(--bg-overlay)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-primary)', flexShrink: 0,
      }}>
        <Icon size={15} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        )}
      </div>
      {right !== undefined ? right : onClick ? <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /> : null}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--accent-primary)' : 'var(--border-strong)',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = React.useState(true);
  const [telemetry, setTelemetry] = React.useState(false);
  const [vectorSearch, setVectorSearch] = React.useState(false);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account, security, and preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
        {/* Account */}
        <SettingSection title="Account">
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div className="avatar avatar-lg">{(user?.displayName || user?.email || '?').slice(0,2).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.displayName || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</div>
                <span className="badge badge-primary" style={{ marginTop: 4 }}>{user?.plan || 'free'}</span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">Edit Profile</button>
          </div>
          <SettingRow icon={Lock} label="Change Password" description="Update your login password" onClick={() => {}} />
        </SettingSection>

        {/* Security */}
        <SettingSection title="Security & Encryption">
          <SettingRow
            icon={Shield}
            label="E2E Encryption Status"
            description="End-to-end encryption for vault and sensitive artifacts"
            right={<span className="badge badge-success">Active</span>}
          />
          <SettingRow
            icon={Cpu}
            label="Trusted Devices"
            description="Manage devices that can decrypt your vault"
            onClick={() => window.location.href = '/devices'}
          />
          <SettingRow
            icon={Shield}
            label="Audit Log"
            description="View vault access and remote operation history"
            onClick={() => {}}
          />
        </SettingSection>

        {/* Preferences */}
        <SettingSection title="Preferences">
          <SettingRow
            icon={Bell}
            label="Desktop Notifications"
            description="Receive sync and daemon alerts"
            right={<Toggle checked={notifications} onChange={() => setNotifications((v) => !v)} />}
          />
          <SettingRow
            icon={Zap}
            label="Semantic Vector Search"
            description="Enable AI-powered semantic search (requires embedding opt-in)"
            right={<Toggle checked={vectorSearch} onChange={() => setVectorSearch((v) => !v)} />}
          />
          <SettingRow
            icon={Settings}
            label="Anonymous Telemetry"
            description="Help improve Dev Command Center with anonymous usage data"
            right={<Toggle checked={telemetry} onChange={() => setTelemetry((v) => !v)} />}
          />
        </SettingSection>

        {/* Danger zone */}
        <SettingSection title="Danger Zone">
          <SettingRow
            icon={Settings}
            label="Export All Data"
            description="Download a full export of your artifacts, vault metadata, and settings"
            onClick={() => {}}
          />
          <div style={{ padding: '14px 20px' }}>
            <button
              className="btn btn-danger"
              onClick={() => window.confirm('Delete your account? This cannot be undone.') && {}}
              id="delete-account-btn"
            >
              Delete Account
            </button>
          </div>
        </SettingSection>

        {/* Version */}
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Dev Command Center v1.0.0-mvp · Phase 1
        </div>
      </div>
    </div>
  );
}
