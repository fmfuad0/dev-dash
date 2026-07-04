import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Grid, List, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useArtifacts, useDeleteArtifact } from '../hooks/useArtifacts.js';
import { useUIStore } from '../store/uiStore.js';
import ArtifactCard from '../components/Artifact/ArtifactCard.jsx';
import CreateArtifactModal from '../components/Artifact/CreateArtifactModal.jsx';

const KIND_FILTERS = [
  { value: '', label: 'All' },
  { value: 'snippet',          label: 'Snippets' },
  { value: 'markdown',         label: 'Notes' },
  { value: 'canvas',           label: 'Canvas' },
  { value: 'credential',       label: 'Vault' },
  { value: 'terminalEvent',    label: 'Terminal' },
  { value: 'remoteConnection', label: 'Remote' },
];

export default function ArtifactsPage() {
  const navigate      = useNavigate();
  const [params, setParams] = useSearchParams();
  const workspaceId   = useUIStore((s) => s.activeWorkspaceId);
  const viewMode      = useUIStore((s) => s.viewMode);
  const setViewMode   = useUIStore((s) => s.setViewMode);

  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ]       = useState(params.get('q') || '');
  const [kind, setKind] = useState(params.get('kind') || '');
  const [page, setPage] = useState(1);

  const queryParams = { workspaceId, page, limit: 24 };
  if (kind) queryParams.kind = kind;
  if (q)    queryParams.q    = q;

  const { data, isLoading, isFetching } = useArtifacts(queryParams);
  const artifacts  = data?.artifacts  || [];
  const pagination = data?.pagination || {};

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
  }

  function handleKind(k) {
    setKind(k);
    setPage(1);
  }

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Artifacts</h1>
          <p className="page-subtitle">
            {pagination.total !== undefined ? `${pagination.total} total` : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-artifact-btn">
          <Plus size={15} /> New Artifact
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 200 }}>
          <div className="search-bar">
            <Search size={14} className="search-icon" />
            <input
              id="artifact-search"
              placeholder="Search artifacts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </form>

        {/* Kind pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleKind(f.value)}
              className={`btn btn-sm ${kind === f.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
        }}>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setViewMode('grid')}
            style={{ borderRadius: 0, color: viewMode === 'grid' ? 'var(--accent-primary)' : undefined }}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setViewMode('list')}
            style={{ borderRadius: 0, color: viewMode === 'list' ? 'var(--accent-primary)' : undefined }}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : artifacts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={48} /></div>
          <div className="empty-state-title">No artifacts found</div>
          <div className="empty-state-description">
            {q || kind ? 'Try adjusting your filters.' : 'Create your first artifact to get started.'}
          </div>
          {!q && !kind && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create Artifact
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'artifact-grid' : 'artifact-list'}>
          {artifacts.map((a) => <ArtifactCard key={a._id} artifact={a} />)}
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >← Prev</button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0 8px' }}>
            Page {page} / {pagination.pages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >Next →</button>
        </div>
      )}

      {showCreate && (
        <CreateArtifactModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => navigate(`/artifacts/${a._id}`)}
        />
      )}
    </div>
  );
}
