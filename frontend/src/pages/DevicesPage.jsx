import React, { useState } from 'react';
import { Cpu, Plus, Check, X, AlertTriangle, Clock, Monitor, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/index.js';
import { toast } from '../store/uiStore.js';
import Modal from '../components/UI/Modal.jsx';
import { formatDistanceToNow } from 'date-fns';

const PLATFORM_ICONS = { darwin: '🍎', linux: '🐧', win32: '🪟', browser: '🌐', unknown: '💻' };

const TRUST_META = {
  trusted: { label: 'Trusted',  color: 'var(--accent-success)', cls: 'badge-success' },
  pending: { label: 'Pending',  color: 'var(--accent-warning)', cls: 'badge-warning' },
  revoked: { label: 'Revoked',  color: 'var(--text-muted)',     cls: 'badge-default' },
};

export default function DevicesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn:  devicesApi.list,
  });
  const devices = data?.devices || [];

  const revokeMutation = useMutation({
    mutationFn: devicesApi.revoke,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device revoked');
    },
    onError: () => toast.error('Failed to revoke device'),
  });

  async function handleRevoke(id, name) {
    if (!window.confirm(`Revoke device "${name}"? It will lose access to encrypted vault items.`)) return;
    revokeMutation.mutate(id);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Devices</h1>
          <p className="page-subtitle">Manage trusted devices that can decrypt your vault</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} id="register-device-btn">
          <Plus size={14} /> Register Device
        </button>
      </div>

      {/* Security note */}
      <div style={{
        display: 'flex', gap: 12, padding: '14px 18px',
        background: 'hsla(255,86%,66%,0.06)',
        border: '1px solid hsla(255,86%,66%,0.2)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <AlertTriangle size={18} style={{ color: 'var(--accent-warning)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Device trust model: </strong>
          Each device holds a unique private key in your OS keychain. Vault secrets are wrapped per-device.
          Revoking a device removes its access — re-registration requires re-wrapping keys.
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : devices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Cpu size={48} /></div>
          <div className="empty-state-title">No devices registered</div>
          <div className="empty-state-description">
            Register this browser or install the local daemon to manage encrypted vault access.
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Register Device
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map((dev) => {
            const trust = TRUST_META[dev.trustStatus] || TRUST_META.pending;
            return (
              <div
                key={dev._id}
                className="card"
                style={{
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  opacity: dev.trustStatus === 'revoked' ? 0.5 : 1,
                }}
                id={`device-${dev._id}`}
              >
                {/* Platform icon */}
                <div style={{
                  width: 40, height: 40, fontSize: '1.3rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  flexShrink: 0,
                }}>
                  {PLATFORM_ICONS[dev.platform] || '💻'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dev.name}</span>
                    <span className={`badge ${trust.cls}`}>{trust.label}</span>
                    {dev.daemonVersion && (
                      <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                        v{dev.daemonVersion}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>{dev.platform}</span>
                    {dev.lastSeenAt && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(dev.lastSeenAt), { addSuffix: true })}
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {dev.fingerprint || dev._id.slice(-8)}
                    </span>
                  </div>
                </div>

                {dev.trustStatus !== 'revoked' && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRevoke(dev._id, dev.name)}
                    disabled={revokeMutation.isPending}
                  >
                    <X size={13} /> Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <RegisterDeviceModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function RegisterDeviceModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', platform: 'browser' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // In Phase 2 the daemon generates real X25519/Ed25519 keypairs
      // For MVP browser registration we generate stub keys
      const stubPublicKey = btoa(Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => String.fromCharCode(b)).join(''));

      await devicesApi.register({
        ...form,
        publicEncryptionKey: stubPublicKey,
        publicSigningKey: stubPublicKey,
        daemonVersion: '0.1.0-mvp',
      });

      qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device registered');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Register Device" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group">
          <label className="input-label">Device Name *</label>
          <input
            className="input"
            placeholder="e.g. MacBook Pro Work, Home Linux"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="input-group">
          <label className="input-label">Platform</label>
          <select className="select" value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
            <option value="browser">Browser</option>
            <option value="darwin">macOS</option>
            <option value="linux">Linux</option>
            <option value="win32">Windows</option>
          </select>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          ℹ️ Full daemon keypair generation available in Phase 2. MVP uses stub keys.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering…' : 'Register'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
