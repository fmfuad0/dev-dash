import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Code2, Search, Lock,
  Terminal, Cpu, Settings, LogOut, Zap, Github,
  ChevronLeft, ChevronRight, TerminalSquare, Bell,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { useSocketStore } from '../../store/socketStore.js';
import { authApi } from '../../api/auth.js';
import WorkspaceSwitcher from '../Workspace/WorkspaceSwitcher.jsx';

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',         icon: LayoutDashboard, end: true },
  { to: '/artifacts',  label: 'Artifacts',          icon: Code2 },
  { to: '/editor',     label: '</Editor>',          icon: Code2 },
  { to: '/terminal',   label: 'Terminal',           icon: TerminalSquare },
  { to: '/terminal-history', label: 'Term History', icon: Terminal },
  { to: '/git',        label: 'Git',                icon: Github },
  { to: '/search',     label: 'Search',             icon: Search },
  { to: '/notifications', label: 'Notifications',   icon: Bell },
  { to: '/vault',      label: 'Vault',              icon: Lock },
  { to: '/devices',    label: 'Devices',            icon: Cpu },
];

export default function Sidebar() {
  const [showUserLogo, setShowUserLogo] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const daemonOnline = useSocketStore((s) => s.daemonOnline);

  async function handleLogout() {
    try { await authApi.logout(); } catch {}
    logout();
    navigate('/login');
  }

  function getInitials(u) {
    if (!u) return '?';
    const name = u.displayName || u.email;
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 56 : undefined,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Logo ── */}
      <div className="sidebar-logo" style={{ cursor: 'pointer', justifyContent: collapsed ? 'center' : undefined }}
        onClick={() => setShowUserLogo(!showUserLogo)}>
        {showUserLogo ? (
          <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.8rem', flexShrink: 0 }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="User" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : getInitials(user)}
          </div>
        ) : (
          <div className="sidebar-logo-icon" style={{ flexShrink: 0 }}>
            <Zap size={18} color="white" />
          </div>
        )}
        {!collapsed && <span className="sidebar-logo-text">DEV DASH</span>}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', top: 14, right: collapsed ? 8 : 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: '50%', width: 20, height: 20, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: 'var(--text-muted)', zIndex: 10, padding: 0,
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* ── Workspace Switcher ── */}
      {!collapsed && (
        <div style={{ padding: '12px 12px 0' }}>
          <WorkspaceSwitcher />
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="sidebar-section">
        {!collapsed && <div className="sidebar-section-label">Navigation</div>}
        <ul className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="sidebar-nav-item">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => isActive ? 'active' : ''}
                title={collapsed ? label : undefined}
              >
                <Icon className="nav-icon" size={16} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </NavLink>
            </li>
          ))}
        </ul>

        {!collapsed && (
          <div style={{ marginTop: 24 }}>
            <div className="sidebar-section-label">System</div>
            <ul className="sidebar-nav">
              <li className="sidebar-nav-item">
                <NavLink to="/workspaces" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FolderKanban className="nav-icon" size={16} />
                  Workspaces
                </NavLink>
              </li>
              <li className="sidebar-nav-item">
                <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
                  <Settings className="nav-icon" size={16} />
                  Settings
                </NavLink>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className={`daemon-indicator ${daemonOnline ? 'daemon-online' : 'daemon-offline'}`}
          style={{ marginBottom: 12, justifyContent: collapsed ? 'center' : undefined }}>
          <div className="daemon-dot" />
          {!collapsed && (daemonOnline ? 'Daemon Online' : 'Daemon Offline')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10 }}>
          <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>{getInitials(user)}</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {user?.displayName || user?.email?.split('@')[0]}
              </div>
              <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {user?.plan || 'free'}
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-ghost btn-icon" title="Logout" style={{ padding: 6 }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
