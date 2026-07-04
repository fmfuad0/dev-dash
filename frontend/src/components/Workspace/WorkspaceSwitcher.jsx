import React, { useState } from 'react';
import { ChevronDown, Plus, FolderKanban, Check } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace } from '../../hooks/useWorkspaces.js';
import { useUIStore } from '../../store/uiStore.js';
import Modal from '../UI/Modal.jsx';

export default function WorkspaceSwitcher() {
  const [open, setOpen]     = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]     = useState({ name: '', slug: '', description: '' });

  const { data, isLoading } = useWorkspaces();
  const workspaces = data?.workspaces || [];

  const activeId = useUIStore((s) => s.activeWorkspaceId);
  const setActive = useUIStore((s) => s.setActiveWorkspace);
  const createMutation = useCreateWorkspace();

  const active = workspaces.find((w) => w._id === activeId) || workspaces[0];

  function handleSelect(ws) {
    setActive(ws._id);
    setOpen(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await createMutation.mutateAsync({ ...form, slug });
    setShowNew(false);
    setForm({ name: '', slug: '', description: '' });
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          className="workspace-pill w-full"
          onClick={() => setOpen((v) => !v)}
          id="workspace-switcher-btn"
        >
          <div
            className="workspace-dot"
            style={{ background: active?.color || '#6366f1' }}
          />
          <span className="truncate flex-1 text-left">
            {isLoading ? 'Loading...' : active?.name || 'Select workspace'}
          </span>
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>

        {open && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 200,
            overflow: 'hidden',
          }}>
            {workspaces.length === 0 && (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No workspaces yet
              </div>
            )}
            {workspaces.map((ws) => (
              <button
                key={ws._id}
                onClick={() => handleSelect(ws)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem',
                  transition: 'background 0.15s',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-overlay)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <div className="workspace-dot" style={{ background: ws.color || '#6366f1' }} />
                <span className="truncate flex-1 text-left">{ws.name}</span>
                {ws._id === activeId && <Check size={12} style={{ color: 'var(--accent-primary)' }} />}
              </button>
            ))}

            <button
              onClick={() => { setOpen(false); setShowNew(true); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.82rem',
                fontWeight: 500,
              }}
            >
              <Plus size={13} />
              New Workspace
            </button>
          </div>
        )}
      </div>

      {/* New workspace modal */}
      {showNew && (
        <Modal title="New Workspace" onClose={() => setShowNew(false)}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Name *</label>
              <input
                className="input"
                placeholder="My Project"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Slug</label>
              <input
                className="input"
                placeholder="my-project"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                pattern="[a-z0-9-]+"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <input
                className="input"
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
