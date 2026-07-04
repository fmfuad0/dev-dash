import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, FileText, Layout, Lock, Terminal, TrendingUp, Plus, ArrowRight, Clock, Zap } from 'lucide-react';
import { useArtifacts } from '../hooks/useArtifacts.js';
import { useWorkspaces } from '../hooks/useWorkspaces.js';
import { useAuthStore } from '../store/authStore.js';
import { useUIStore } from '../store/uiStore.js';
import ArtifactCard from '../components/Artifact/ArtifactCard.jsx';
import CreateArtifactModal from '../components/Artifact/CreateArtifactModal.jsx';

const KIND_STATS = [
  { key: 'snippet',    label: 'Snippets',   icon: Code2,    cls: 'stat-snippets' },
  { key: 'markdown',   label: 'Notes',      icon: FileText, cls: 'stat-markdown' },
  { key: 'credential', label: 'Vault Items',icon: Lock,     cls: 'stat-vault' },
  { key: 'terminalEvent',label:'Commands',  icon: Terminal, cls: 'stat-terminal' },
];

export default function DashboardPage() {
  const navigate     = useNavigate();
  const user         = useAuthStore((s) => s.user);
  const workspaceId  = useUIStore((s) => s.activeWorkspaceId);
  const [showCreate, setShowCreate] = useState(false);

  const { data: allData }      = useArtifacts({ workspaceId, limit: 100 });
  const { data: recentData }   = useArtifacts({ workspaceId, limit: 6, sort: 'updatedAt', order: 'desc' });
  const { data: pinnedData }   = useArtifacts({ workspaceId, pinned: true, limit: 4 });
  const { data: wsData }       = useWorkspaces();

  const all     = allData?.artifacts || [];
  const recent  = recentData?.artifacts || [];
  const pinned  = pinnedData?.artifacts || [];
  const wsCount = wsData?.workspaces?.length || 0;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Developer';

  return (
    <div className="page-content">
      {/* ── Hero greeting ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(255,86%,66%,0.1) 0%, hsla(200,100%,55%,0.06) 100%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200,
          background: 'radial-gradient(circle, hsla(255,86%,66%,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Zap size={20} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>
            {greeting},{' '}
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {firstName}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {all.length > 0
              ? `You have ${all.length} artifacts across ${wsCount} workspace${wsCount !== 1 ? 's' : ''}`
              : 'Start by creating your first artifact or workspace'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="dashboard-create-btn">
          <Plus size={15} /> New Artifact
        </button>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        {KIND_STATS.map(({ key, label, icon: Icon, cls }) => {
          const count = all.filter((a) => a.kind === key).length;
          return (
            <div key={key} className={`stat-card ${cls}`} style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/artifacts?kind=${key}`)}>
              <div className="stat-card-icon"><Icon size={36} /></div>
              <div className="stat-card-value">{count}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Pinned artifacts ────────────────────────────────────────────────── */}
      {pinned.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>📌 Pinned</h2>
          </div>
          <div className="artifact-grid">
            {pinned.map((a) => <ArtifactCard key={a._id} artifact={a} />)}
          </div>
        </section>
      )}

      {/* ── Recent artifacts ────────────────────────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: 'var(--accent-primary)' }} /> Recent
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/artifacts')}
            style={{ gap: 4 }}
          >
            View all <ArrowRight size={13} />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Code2 size={48} /></div>
            <div className="empty-state-title">No artifacts yet</div>
            <div className="empty-state-description">
              Create snippets, markdown notes, canvas diagrams, and more. Everything syncs across your devices.
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create First Artifact
            </button>
          </div>
        ) : (
          <div className="artifact-grid">
            {recent.map((a) => <ArtifactCard key={a._id} artifact={a} />)}
          </div>
        )}
      </section>

      {showCreate && (
        <CreateArtifactModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => navigate(`/artifacts/${a._id}`)}
        />
      )}
    </div>
  );
}
