import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Plus } from 'lucide-react';
import { useUIStore } from '../../store/uiStore.js';
import { useSocketStore } from '../../store/socketStore.js';

const ROUTE_TITLES = {
  '/':           'Dashboard',
  '/workspaces': 'Workspaces',
  '/artifacts':  'Artifacts',
  '/search':     'Search',
  '/vault':      'Vault',
  '/terminal':   'Terminal History',
  '/devices':    'Devices',
  '/settings':   'Settings',
};

export default function Topbar() {
  const location  = useLocation();
  const connected = useSocketStore((s) => s.connected);
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);

  const title = ROUTE_TITLES[location.pathname] || 'Dev Command Center';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title}</span>
      </div>

      <div className="topbar-right">
        {/* Quick search shortcut */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={openCommandPalette}
          style={{ gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}
        >
          <Search size={14} />
          <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Search
            <kbd style={{
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}>⌘K</kbd>
          </span>
        </button>

        {/* Socket status dot */}
        <div
          title={connected ? 'Connected' : 'Disconnected'}
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--accent-success)' : 'var(--text-muted)',
            boxShadow: connected ? '0 0 6px var(--accent-success)' : 'none',
            transition: 'all 0.3s',
          }}
        />
      </div>
    </header>
  );
}
