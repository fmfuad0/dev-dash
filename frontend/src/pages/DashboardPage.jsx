import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code2, FileText, Layout, Lock, Terminal, TrendingUp, 
  Plus, ArrowRight, Clock, Zap, Hash, Activity, 
  Layers, Database, Settings, BookOpen, Server, FileCode, Shield, Folder
} from 'lucide-react';
import { useArtifacts, useArtifactStats } from '../hooks/useArtifacts.js';
import { useWorkspaces } from '../hooks/useWorkspaces.js';
import { useAuthStore } from '../store/authStore.js';
import { useUIStore } from '../store/uiStore.js';
import ArtifactCard from '../components/Artifact/ArtifactCard.jsx';
import CreateArtifactModal from '../components/Artifact/CreateArtifactModal.jsx';

import { CATEGORIES } from '../utils/artifactResources.js';

export default function DashboardPage() {
  const navigate     = useNavigate();
  const user         = useAuthStore((s) => s.user);
  const workspaceId  = useUIStore((s) => s.activeWorkspaceId);
  const [showCreate, setShowCreate] = useState(false);

  const { data: allData }      = useArtifactStats({ workspaceId });
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

  // Compute Stats dynamically
  const stats = useMemo(() => {
    const uniqueTags = new Set();
    let updatedTodayCount = 0;
    
    const categoryToGroup = Object.fromEntries(CATEGORIES.map(c => [c.name, c.group]));
    const domainCounts = {};
    const fileTypeCounts = {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    all.forEach(a => {
      // Tags
      if (a.tags && Array.isArray(a.tags)) {
        a.tags.forEach(t => uniqueTags.add(t));
      }
      
      // Updated Today
      if (new Date(a.updatedAt) >= today) {
        updatedTodayCount++;
      }
      
      // Domain counts
      if (a.category) {
        const group = categoryToGroup[a.category] || 'Other';
        domainCounts[group] = (domainCounts[group] || 0) + 1;
      }
      
      // File Type counts
      if (a.fileType) {
        fileTypeCounts[a.fileType] = (fileTypeCounts[a.fileType] || 0) + 1;
      }
    });

    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const sortedFileTypes = Object.entries(fileTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
      
    return {
      totalArtifacts: all.length,
      uniqueTags: uniqueTags.size,
      updatedToday: updatedTodayCount,
      sortedDomains,
      sortedFileTypes
    };
  }, [all]);

  const getDomainIcon = (group) => {
    switch (group) {
      case 'Frontend/UI': return <Layout size={20} />;
      case 'Backend/API': return <Server size={20} />;
      case 'Core source code': return <FileCode size={20} />;
      case 'Database/data layer': return <Database size={20} />;
      case 'Development environment/tooling': return <Settings size={20} />;
      case 'Deployment/infrastructure/operations': return <Activity size={20} />;
      case 'Testing/security/quality': return <Shield size={20} />;
      case 'Data science/docs/examples': return <BookOpen size={20} />;
      default: return <Layers size={20} />;
    }
  };

  return (
    <div className="page-content">
      {/* ── Hero greeting ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(255,86%,66%,0.1) 0%, hsla(200,100%,55%,0.06) 100%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
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

      {/* ── System Overview ─────────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card-icon" style={{ color: 'var(--accent-primary)', background: 'var(--bg-highlight)' }}><FileText size={24} /></div>
          <div className="stat-card-value">{stats.totalArtifacts}</div>
          <div className="stat-card-label">Total Artifacts</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card-icon" style={{ color: 'var(--accent-secondary)', background: 'var(--bg-highlight)' }}><Folder size={24} /></div>
          <div className="stat-card-value">{wsCount}</div>
          <div className="stat-card-label">Total Workspaces</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card-icon" style={{ color: 'var(--success)', background: 'var(--bg-highlight)' }}><Hash size={24} /></div>
          <div className="stat-card-value">{stats.uniqueTags}</div>
          <div className="stat-card-label">Unique Tags</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card-icon" style={{ color: 'var(--warning)', background: 'var(--bg-highlight)' }}><Activity size={24} /></div>
          <div className="stat-card-value">{stats.updatedToday}</div>
          <div className="stat-card-label">Active Today</div>
        </div>
      </div>

      {/* ── Detailed Breakdowns ────────────────────────────────────────────────── */}
      {(stats.sortedDomains.length > 0 || stats.sortedFileTypes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 24, marginBottom: 32 }}>
          {/* Domains */}
          {stats.sortedDomains.length > 0 && (
            <div style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                <Layers size={16} /> Artifacts by Domain
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.sortedDomains.map(([group, count]) => (
                  <div key={group} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ color: 'var(--text-muted)' }}>{getDomainIcon(group)}</div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{group}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '4px 10px', borderRadius: '12px' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* File Types */}
          {stats.sortedFileTypes.length > 0 && (
            <div style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                <Code2 size={16} /> Top File Types
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.sortedFileTypes.map(([ext, count]) => (
                  <div key={ext} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', width: 44, textAlign: 'center' }}>{ext}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '4px 10px', borderRadius: '12px' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
