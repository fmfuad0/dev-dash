import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import EditorPage from '../../pages/EditorPage.jsx';
import TerminalStandalonePage from '../../pages/TerminalStandalonePage.jsx';

// These routes take full height with no page wrapper/topbar padding
const FULLSCREEN_ROUTES = ['/editor', '/terminal'];

export default function AppLayout() {
  const { pathname } = useLocation();
  const isFullscreen = FULLSCREEN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  const showEditor = pathname.startsWith('/editor');
  const showTerminal = pathname === '/terminal';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area" style={isFullscreen ? { overflow: 'hidden' } : {}}>
        {!isFullscreen && <Topbar />}
        <div style={isFullscreen
          ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }
          : { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }
        }>
          <div style={{ display: showEditor ? 'block' : 'none', height: '100%' }}>
            <EditorPage />
          </div>
          <div style={{ display: showTerminal ? 'block' : 'none', height: '100%' }}>
            <TerminalStandalonePage />
          </div>
          <div style={{ display: (!showEditor && !showTerminal) ? 'block' : 'none', height: '100%' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
