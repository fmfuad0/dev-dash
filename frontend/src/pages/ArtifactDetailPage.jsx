import React, { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Trash2, Pin, PinOff, Clock, Tag, Link2,
  Code2, Copy, Check, History, ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useArtifact, useUpdateArtifact, useDeleteArtifact, useArtifactVersions } from '../hooks/useArtifacts.js';
import { toast } from '../store/uiStore.js';

const KIND_LABEL = {
  snippet: 'Snippet', markdown: 'Note', canvas: 'Canvas',
  credential: 'Vault', remoteConnection: 'Remote', terminalEvent: 'Terminal',
};

export default function ArtifactDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const { data, isLoading } = useArtifact(id);
  const artifact = data?.artifact;

  const updateMutation = useUpdateArtifact(id);
  const deleteMutation = useDeleteArtifact();

  const [editing, setEditing]     = useState(false);
  const [content, setContent]     = useState('');
  const [title, setTitle]         = useState('');
  const [tagInput, setTagInput]   = useState('');
  const [tags, setTags]           = useState([]);
  const [copied, setCopied]       = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: vData } = useArtifactVersions(id, { limit: 10 });
  const versions = vData?.versions || [];

  // Sync form when artifact loads
  useEffect(() => {
    if (artifact) {
      setContent(artifact.contentText || '');
      setTitle(artifact.title || '');
      setTags(artifact.tags || []);
    }
  }, [artifact]);

  async function handleSave() {
    await updateMutation.mutateAsync({ title, contentText: content, tags });
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this artifact? This cannot be undone.')) return;
    await deleteMutation.mutateAsync(id);
    navigate('/artifacts');
  }

  async function handlePin() {
    await updateMutation.mutateAsync({ isPinned: !artifact.isPinned });
  }

  function handleCopy() {
    navigator.clipboard.writeText(artifact?.contentText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Copied to clipboard');
  }

  function addTag(e) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag)) setTags((t) => [...t, tag]);
      setTagInput('');
    }
  }

  function removeTag(tag) { setTags((t) => t.filter((x) => x !== tag)); }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, height: '100%' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-state-title">Artifact not found</div>
          <button className="btn btn-secondary" onClick={() => navigate('/artifacts')}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>
    );
  }

  const isCode = artifact.kind === 'snippet' || artifact.kind === 'terminalEvent';

  return (
    <div className="page-content">
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => setShowHistory((v) => !v)}
          title="Version history"
          style={{ color: showHistory ? 'var(--accent-primary)' : undefined }}
        >
          <History size={14} />
        </button>

        <button className="btn btn-ghost btn-sm btn-icon" onClick={handleCopy} title="Copy content">
          {copied ? <Check size={14} style={{ color: 'var(--accent-success)' }} /> : <Copy size={14} />}
        </button>

        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={handlePin}
          title={artifact.isPinned ? 'Unpin' : 'Pin'}
          style={{ color: artifact.isPinned ? 'var(--accent-warning)' : undefined }}
        >
          {artifact.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>

        {editing ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setContent(artifact.contentText || ''); setTitle(artifact.title); }}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <Save size={13} /> {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}

        <button className="btn btn-danger btn-sm btn-icon" onClick={handleDelete} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showHistory ? '1fr 280px' : '1fr', gap: 20 }}>
        {/* ── Main content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className={`badge badge-default kind-${artifact.kind}`}>
                  {KIND_LABEL[artifact.kind] || artifact.kind}
                </span>
                {artifact.language && (
                  <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    {artifact.language}
                  </span>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} />
                  {artifact.updatedAt
                    ? formatDistanceToNow(new Date(artifact.updatedAt), { addSuffix: true })
                    : ''}
                </span>
              </div>

              {editing ? (
                <input
                  className="input"
                  style={{ fontSize: '1.2rem', fontWeight: 700, background: 'var(--bg-elevated)' }}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              ) : (
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {artifact.title}
                </h1>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {(editing ? tags : artifact.tags || []).map((tag) => (
              <span key={tag} className="badge badge-primary" style={{ gap: 4 }}>
                <Tag size={9} /> {tag}
                {editing && (
                  <button
                    onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', marginLeft: 2 }}
                  >×</button>
                )}
              </span>
            ))}
            {editing && (
              <input
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-full)', padding: '2px 10px',
                  fontSize: '0.78rem', color: 'var(--text-primary)', outline: 'none', minWidth: 100,
                }}
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
              />
            )}
          </div>

          {/* ── Content Area ── */}
          <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', height: 450 }}>
            <div className="editor-toolbar">
              <div className="editor-dots">
                <div className="editor-dot editor-dot-red" />
                <div className="editor-dot editor-dot-yellow" />
                <div className="editor-dot editor-dot-green" />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: 1, paddingLeft: 8 }}>
                {artifact.title}
              </span>
              {artifact.language && (
                <span className="editor-lang-badge">{artifact.language}</span>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <Editor
                height="100%"
                language={artifact.language || (isCode ? 'javascript' : 'markdown')}
                theme="vs-dark"
                value={editing ? content : (artifact.contentText || '')}
                onChange={(value) => setContent(value || '')}
                options={{
                  readOnly: !editing,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'var(--font-mono), monospace',
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
          </div>

          {/* ── Metadata ── */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Metadata</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Created', value: artifact.createdAt ? format(new Date(artifact.createdAt), 'MMM d, yyyy') : '—' },
                  { label: 'Updated', value: artifact.updatedAt ? format(new Date(artifact.updatedAt), 'MMM d, yyyy HH:mm') : '—' },
                  { label: 'Visibility', value: artifact.visibility || 'private' },
                  { label: 'Source', value: artifact.source?.type || 'manual' },
                  { label: 'Privacy', value: artifact.search?.privacyClass || 'plain' },
                  { label: 'AST', value: artifact.ast?.status || 'none' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Version History Panel ── */}
        {showHistory && (
          <aside className="card" style={{ padding: 0, alignSelf: 'start', position: 'sticky', top: 0 }}>
            <div className="card-header">
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Version History</span>
              <span className="badge badge-default">{vData?.pagination?.total || 0}</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {versions.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No versions yet
                </div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v._id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)' }}>
                        v{v.version}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {v.updatedAt ? formatDistanceToNow(new Date(v.updatedAt), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    {v.changeNote && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.changeNote}</div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {v.source?.type || 'manual'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
