import React, { useState } from 'react';
import { FolderKanban, Plus, Archive, Settings, Globe, Lock, Shield } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace } from '../hooks/useWorkspaces.js';
import { useUIStore } from '../store/uiStore.js';
import Modal from '../components/UI/Modal.jsx';
import { formatDistanceToNow } from 'date-fns';

const PRIVACY_META = {
  standard:    { label: 'Standard', icon: Globe,  color: 'var(--accent-info)',    cls: 'badge-info' },
  e2e:         { label: 'E2E',      icon: Shield, color: 'var(--accent-success)', cls: 'badge-success' },
  'local-only':{ label: 'Local',    icon: Lock,   color: 'var(--accent-warning)', cls: 'badge-warning' },
};

const WORKSPACE_COLORS = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4',
];

export default function WorkspacesPage() {
  const setActive = useUIStore((s) => s.setActiveWorkspace);
  const activeId  = useUIStore((s) => s.activeWorkspaceId);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', color: WORKSPACE_COLORS[0], privacyMode: 'standard' });

  const { data, isLoading } = useWorkspaces();
  const workspaces = data?.workspaces || [];
  const { mutateAsync, isPending } = useCreateWorkspace();

  async function handleCreate(e) {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await mutateAsync({ ...form, slug });
    setShowCreate(false);
    setForm({ name: '', slug: '', description: '', color: WORKSPACE_COLORS[0], privacyMode: 'standard' });
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspaces</h1>
          <p className="page-subtitle">Organize artifacts by project or context</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-workspace-btn">
          <Plus size={14} /> New Workspace
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderKanban size={48} /></div>
          <div className="empty-state-title">No workspaces yet</div>
          <div className="empty-state-description">Create a workspace to organize your snippets, notes, and secrets by project.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Workspace</button>
        </div>
      ) : (
        <div className="grid-3">
          {workspaces.map((ws) => {
            const privacy = PRIVACY_META[ws.privacyMode] || PRIVACY_META.standard;
            const PrivIcon = privacy.icon;
            const isActive = ws._id === activeId;
            return (
              <div
                key={ws._id}
                className="card card-interactive"
                style={{
                  padding: '20px',
                  borderColor: isActive ? 'hsla(255,86%,66%,0.4)' : undefined,
                  boxShadow: isActive ? 'var(--shadow-glow)' : undefined,
                }}
                onClick={() => setActive(ws._id)}
                id={`workspace-${ws._id}`}
              >
                {/* Color accent line */}
                <div style={{
                  height: 3, borderRadius: 2, marginBottom: 16,
                  background: ws.color || 'var(--gradient-brand)',
                  backgroundImage: `linear-gradient(90deg, ${ws.color || '#6366f1'}, ${ws.color || '#0ea5e9'})`,
                }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: ws.color || '#6366f1',
                        boxShadow: `0 0 6px ${ws.color || '#6366f1'}`,
                      }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{ws.name}</h3>
                    </div>
                    {ws.description && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, marginBottom: 8 }}>
                        {ws.description}
                      </p>
                    )}
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      /{ws.slug}
                    </code>
                  </div>
                  {isActive && (
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem', flexShrink: 0 }}>Active</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <span className={`badge ${privacy.cls}`} style={{ gap: 4, fontSize: '0.7rem' }}>
                    <PrivIcon size={10} /> {privacy.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {ws.updatedAt ? formatDistanceToNow(new Date(ws.updatedAt), { addSuffix: true }) : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="New Workspace" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label">Name *</label>
              <input className="input" placeholder="My Project" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label className="input-label">Slug</label>
              <input className="input" placeholder="my-project" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <input className="input" placeholder="Optional" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Privacy Mode</label>
              <select className="select" value={form.privacyMode}
                onChange={(e) => setForm((f) => ({ ...f, privacyMode: e.target.value }))}>
                <option value="standard">Standard — metadata indexed in cloud</option>
                <option value="e2e">E2E — all content encrypted client-side</option>
                <option value="local-only">Local Only — never synced to cloud</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Accent Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {WORKSPACE_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer',
                      outline: form.color === c ? `3px solid ${c}` : '3px solid transparent',
                      outlineOffset: 2, transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
