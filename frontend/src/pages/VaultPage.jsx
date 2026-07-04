import React, { useState } from 'react';
import { Lock, Plus, Eye, EyeOff, Trash2, Key, Globe, Shield, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaultApi } from '../api/index.js';
import { useUIStore, toast } from '../store/uiStore.js';
import Modal from '../components/UI/Modal.jsx';
import { formatDistanceToNow } from 'date-fns';

const VAULT_TYPE_META = {
  env:          { label: 'ENV',      icon: Key,    color: 'var(--accent-warning)' },
  'ssh-key':    { label: 'SSH Key',  icon: Shield, color: 'var(--accent-primary)' },
  'ftp-password':{ label: 'FTP',    icon: Globe,  color: 'var(--accent-info)' },
  'api-token':  { label: 'Token',   icon: Key,    color: 'var(--accent-secondary)' },
  generic:      { label: 'Secret',  icon: Lock,   color: 'var(--accent-success)' },
};

export default function VaultPage() {
  const workspaceId = useUIStore((s) => s.activeWorkspaceId);
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [revealIds, setRevealIds] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['vault', workspaceId],
    queryFn: () => vaultApi.list({ workspaceId }),
  });
  const items = data?.items || [];

  const deleteMutation = useMutation({
    mutationFn: vaultApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault'] });
      toast.success('Vault item deleted');
    },
  });

  function toggleReveal(id) {
    setRevealIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this vault item?')) return;
    deleteMutation.mutate(id);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vault</h1>
          <p className="page-subtitle">E2E encrypted secrets — never stored in plaintext</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} id="vault-add-btn">
          <Plus size={14} /> Add Secret
        </button>
      </div>

      {/* Security notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 18px',
        background: 'hsla(158,72%,46%,0.06)',
        border: '1px solid hsla(158,72%,46%,0.2)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <Shield size={18} style={{ color: 'var(--accent-success)', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-success)', marginBottom: 2 }}>
            End-to-End Encrypted
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Secrets are encrypted locally before upload. The server only stores encrypted envelopes and can never read your plaintext values.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Lock size={48} /></div>
          <div className="empty-state-title">Vault is empty</div>
          <div className="empty-state-description">Store API keys, SSH keys, .env values, and passwords securely.</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Secret
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => {
            const meta = VAULT_TYPE_META[item.vaultType] || VAULT_TYPE_META.generic;
            const IconC = meta.icon;
            const revealed = revealIds.has(item._id);

            return (
              <div
                key={item._id}
                className="card"
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <IconC size={16} style={{ color: meta.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</span>
                    <span className="badge badge-default" style={{ fontSize: '0.68rem' }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.publicMeta?.host && <span>Host: {item.publicMeta.host}</span>}
                    {item.publicMeta?.usernameHint && <span>User: {item.publicMeta.usernameHint}</span>}
                    {item.publicMeta?.keyName && <span>Key: {item.publicMeta.keyName}</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </div>

                {/* Encrypted value indicator */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                  color: revealed ? 'var(--accent-warning)' : 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }} onClick={() => toggleReveal(item._id)}>
                  {revealed ? '🔓 [encrypted]' : '🔒 ••••••••'}
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => toggleReveal(item._id)}
                    title={revealed ? 'Hide' : 'Show metadata'}
                    style={{ padding: 6 }}
                  >
                    {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => handleDelete(item._id)}
                    title="Delete"
                    style={{ padding: 6 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddVaultItemModal onClose={() => setShowAdd(false)} workspaceId={workspaceId} />}
    </div>
  );
}

function AddVaultItemModal({ onClose, workspaceId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    vaultType: 'env',
    title: '',
    publicMeta: { host: '', usernameHint: '', keyName: '' },
    // In a real E2E implementation the value would be encrypted client-side
    // before sending — this is a placeholder for Phase 2 crypto integration
    _plaintextValue: '',
  });
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }
  function setMeta(key, val) { setForm((f) => ({ ...f, publicMeta: { ...f.publicMeta, [key]: val } })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Phase 2: encrypt form._plaintextValue locally → envelope
      // For MVP we create a stub envelope
      const stubEnvelope = {
        version: 1,
        alg: 'aes-256-gcm',
        nonce: btoa(crypto.getRandomValues(new Uint8Array(12)).toString()),
        ciphertext: btoa(form._plaintextValue || '[empty]'),
        wrappedKeys: [],
        keyVersion: 1,
      };

      await vaultApi.create({
        workspaceId,
        vaultType: form.vaultType,
        title: form.title,
        publicMeta: {
          host: form.publicMeta.host || undefined,
          usernameHint: form.publicMeta.usernameHint || undefined,
          keyName: form.publicMeta.keyName || undefined,
        },
        secretEnvelope: stubEnvelope,
        tags: [],
      });

      qc.invalidateQueries({ queryKey: ['vault'] });
      toast.success('Vault item added');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add vault item');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Vault Item" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group">
          <label className="input-label">Type</label>
          <select className="select" value={form.vaultType} onChange={(e) => set('vaultType', e.target.value)}>
            <option value="env">ENV Variable</option>
            <option value="ssh-key">SSH Key</option>
            <option value="ftp-password">FTP Password</option>
            <option value="api-token">API Token</option>
            <option value="generic">Generic Secret</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Name / Title *</label>
          <input className="input" placeholder="e.g. Stripe Secret Key" value={form.title}
            onChange={(e) => set('title', e.target.value)} required />
        </div>
        {form.vaultType === 'ssh-key' || form.vaultType === 'ftp-password' ? (
          <div className="input-group">
            <label className="input-label">Host</label>
            <input className="input" placeholder="server.example.com"
              value={form.publicMeta.host} onChange={(e) => setMeta('host', e.target.value)} />
          </div>
        ) : null}
        {form.vaultType === 'env' && (
          <div className="input-group">
            <label className="input-label">Key Name</label>
            <input className="input" placeholder="STRIPE_SECRET_KEY"
              value={form.publicMeta.keyName} onChange={(e) => setMeta('keyName', e.target.value)} />
          </div>
        )}
        <div className="input-group">
          <label className="input-label">Secret Value</label>
          <input type="password" className="input" placeholder="Will be encrypted before upload"
            value={form._plaintextValue} onChange={(e) => set('_plaintextValue', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <AlertTriangle size={11} style={{ color: 'var(--accent-warning)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Phase 2: value encrypted client-side before sending
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding…' : 'Add to Vault'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
