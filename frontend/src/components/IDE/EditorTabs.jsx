import React, { useRef } from 'react';
import { X, Circle } from 'lucide-react';
import { useIdeStore } from '../../store/ideStore.js';

export default function EditorTabs() {
  const openTabs = useIdeStore((s) => s.openTabs);
  const activeTabPath = useIdeStore((s) => s.activeTabPath);
  const setActiveTab = useIdeStore((s) => s.setActiveTab);
  const closeTab = useIdeStore((s) => s.closeTab);
  const tabsRef = useRef(null);

  if (openTabs.length === 0) return null;

  const handleClose = (e, path) => {
    e.stopPropagation();
    closeTab(path);
  };

  const getFileIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    const colors = {
      js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
      py: '#3572a5', html: '#e34c26', css: '#563d7c', json: '#f0db4f',
      md: '#083fa1', sh: '#89e051', yml: '#cb171e', yaml: '#cb171e',
      go: '#00add8', rs: '#dea584', java: '#b07219', rb: '#701516',
    };
    return colors[ext] || 'var(--text-muted)';
  };

  return (
    <div
      ref={tabsRef}
      style={{
        display: 'flex',
        overflowX: 'auto',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-default)',
        minHeight: 35,
        flexShrink: 0,
      }}
      className="hide-scrollbar"
    >
      {openTabs.map((tab) => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            onClick={() => setActiveTab(tab.path)}
            title={tab.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 6,
              minWidth: 120,
              maxWidth: 200,
              cursor: 'pointer',
              fontSize: '0.82rem',
              borderRight: '1px solid var(--border-subtle)',
              background: isActive ? 'var(--bg-elevated)' : 'var(--bg-base)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {/* Dirty dot */}
            {tab.isDirty ? (
              <Circle size={8} fill="var(--accent-warning)" color="var(--accent-warning)" />
            ) : (
              <span style={{ width: 8, display: 'inline-block' }} />
            )}
            {/* File color dot */}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: getFileIcon(tab.name), flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tab.name}
            </span>
            <button
              onClick={(e) => handleClose(e, tab.path)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                padding: 2, borderRadius: 3, flexShrink: 0,
              }}
              className="hover-bg-subtle"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
