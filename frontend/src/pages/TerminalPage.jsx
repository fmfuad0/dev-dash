import React, { useState } from 'react';
import { Terminal, Filter, CheckCircle, XCircle, Clock, GitBranch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { terminalApi } from '../api/index.js';
import { useUIStore } from '../store/uiStore.js';
import { formatDistanceToNow, format } from 'date-fns';

const CLASS_COLORS = {
  normal:      'var(--text-muted)',
  error:       'var(--accent-danger)',
  install:     'var(--accent-info)',
  git:         'var(--accent-primary)',
  deploy:      'var(--accent-warning)',
  test:        'var(--accent-secondary)',
  'secret-risk': 'var(--accent-danger)',
};

const CLASSIFICATIONS = ['', 'normal', 'error', 'install', 'git', 'deploy', 'test'];

export default function TerminalHistoryPage() {
  const workspaceId = useUIStore((s) => s.activeWorkspaceId);
  const [classification, setClass] = useState('');
  const [shell, setShell] = useState('');
  const [page, setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['terminal', workspaceId, classification, shell, page],
    queryFn: () => terminalApi.list({ workspaceId, classification: classification || undefined, shell: shell || undefined, page, limit: 40 }),
  });

  const events     = data?.events     || [];
  const pagination = data?.pagination || {};

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Terminal History</h1>
          <p className="page-subtitle">{pagination.total ?? 0} captured commands</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} /> Class:
        </span>
        {CLASSIFICATIONS.map((c) => (
          <button
            key={c || 'all'}
            onClick={() => { setClass(c); setPage(1); }}
            className={`btn btn-sm ${classification === c ? 'btn-primary' : 'btn-secondary'}`}
            style={c ? { color: CLASS_COLORS[c] } : {}}
          >
            {c || 'All'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <select
            className="select"
            style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem' }}
            value={shell}
            onChange={(e) => { setShell(e.target.value); setPage(1); }}
          >
            <option value="">All Shells</option>
            <option value="bash">bash</option>
            <option value="zsh">zsh</option>
            <option value="fish">fish</option>
            <option value="powershell">powershell</option>
          </select>
        </div>
      </div>

      {/* ── Terminal view ── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Terminal size={48} /></div>
          <div className="empty-state-title">No commands captured</div>
          <div className="empty-state-description">
            Install the daemon and run <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>dcc save-history</code> to import your shell history.
          </div>
        </div>
      ) : (
        <div className="terminal-card">
          {/* Header bar */}
          <div style={{
            background: 'var(--bg-elevated)',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div className="editor-dots">
              <div className="editor-dot editor-dot-red" />
              <div className="editor-dot editor-dot-yellow" />
              <div className="editor-dot editor-dot-green" />
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              terminal history — {events.length} results
            </span>
          </div>

          {events.map((ev) => (
            <div key={ev._id} className="terminal-line" id={`cmd-${ev._id}`}>
              <span className="terminal-prompt">$</span>
              <span className="terminal-cmd" style={{ color: CLASS_COLORS[ev.classification] || 'var(--text-primary)' }}>
                {ev.commandPreview || '(encrypted)'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
                {ev.git?.branch && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--accent-primary)', fontSize: '0.72rem' }}>
                    <GitBranch size={10} /> {ev.git.branch}
                  </span>
                )}
                {ev.shell && (
                  <span className="badge badge-default" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{ev.shell}</span>
                )}
                {ev.exitCode !== undefined && ev.exitCode !== null && (
                  ev.exitCode === 0
                    ? <CheckCircle size={12} className="terminal-exit-ok" />
                    : <XCircle size={12} className="terminal-exit-fail" />
                )}
                {ev.durationMs && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} /> {ev.durationMs}ms
                  </span>
                )}
                <span className="terminal-time">
                  {ev.capturedAt ? formatDistanceToNow(new Date(ev.capturedAt), { addSuffix: true }) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0 8px' }}>
            {page} / {pagination.pages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
