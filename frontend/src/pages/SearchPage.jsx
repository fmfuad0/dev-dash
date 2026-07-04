import React, { useState } from 'react';
import { Search, Sparkles, Clock, Tag, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../api/index.js';
import { useUIStore } from '../store/uiStore.js';
import ArtifactCard from '../components/Artifact/ArtifactCard.jsx';

export default function SearchPage() {
  const workspaceId = useUIStore((s) => s.activeWorkspaceId);
  const [q, setQ]         = useState('');
  const [submitted, setSubmitted] = useState('');
  const [kinds, setKinds] = useState('');
  const [tag, setTag]     = useState('');

  const { data: tagData }  = useQuery({
    queryKey: ['search-tags', workspaceId],
    queryFn:  () => searchApi.tags({ workspaceId }),
    enabled: !!workspaceId,
  });
  const allTags = tagData?.tags || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', submitted, kinds, tag, workspaceId],
    queryFn:  () => searchApi.search({ q: submitted, workspaceId, kinds, tags: tag, limit: 30 }),
    enabled:  !!submitted,
  });
  const results    = data?.results    || [];
  const pagination = data?.pagination || {};

  function handleSubmit(e) {
    e.preventDefault();
    if (q.trim()) setSubmitted(q.trim());
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="page-subtitle">Full-text search across all your artifacts</p>
        </div>
      </div>

      {/* ── Search form ── */}
      <form onSubmit={handleSubmit}>
        <div className="search-bar" style={{ padding: '6px 16px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
          <Search size={18} className="search-icon" />
          <input
            id="global-search"
            placeholder="Search snippets, notes, commands, vault items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ fontSize: '1rem', padding: '10px 0' }}
            autoFocus
          />
          {(isLoading || isFetching) && <div className="spinner" style={{ width: 16, height: 16 }} />}
          <button type="submit" className="btn btn-primary btn-sm" disabled={!q.trim()}>
            Search
          </button>
        </div>
      </form>

      {/* ── Filters ── */}
      {submitted && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} /> Filter:
          </span>
          {['snippet', 'markdown', 'canvas', 'terminalEvent'].map((k) => (
            <button
              key={k}
              onClick={() => setKinds((v) => v === k ? '' : k)}
              className={`btn btn-sm ${kinds === k ? 'btn-primary' : 'btn-secondary'}`}
            >
              {k}
            </button>
          ))}
          {allTags.slice(0, 8).map((t) => (
            <button
              key={t}
              onClick={() => setTag((v) => v === t ? '' : t)}
              className={`btn btn-sm ${tag === t ? 'btn-primary' : 'btn-ghost'}`}
              style={{ gap: 4 }}
            >
              <Tag size={10} /> {t}
            </button>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {!submitted && (
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <div className="empty-state-icon"><Sparkles size={48} /></div>
          <div className="empty-state-title">Start searching</div>
          <div className="empty-state-description">
            Search across snippets, markdown notes, terminal history, canvas artifacts, and vault items.
          </div>
        </div>
      )}

      {submitted && !isLoading && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={48} /></div>
          <div className="empty-state-title">No results for "{submitted}"</div>
          <div className="empty-state-description">Try different keywords or remove filters.</div>
        </div>
      )}

      {results.length > 0 && (
        <section>
          <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {pagination.total} result{pagination.total !== 1 ? 's' : ''} for <strong style={{ color: 'var(--text-primary)' }}>"{submitted}"</strong>
          </div>
          <div className="artifact-grid">
            {results.map((a) => <ArtifactCard key={a._id} artifact={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}
