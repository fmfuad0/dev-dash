import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import GlobalSearchbar from './GlobalSearchbar.jsx';
import EditorPage from '../../pages/EditorPage.jsx';

// These routes take full height with no page wrapper/topbar padding
const FULLSCREEN_ROUTES = ['/editor'];

export default function AppLayout() {
  const { pathname } = useLocation();
  const isFullscreen = FULLSCREEN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  const showEditor = pathname.startsWith('/editor');
  const showCanvas = pathname.startsWith('/canvas');

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area" style={isFullscreen ? { overflow: 'hidden' } : {}}>
        <div style={isFullscreen
          ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }
          : { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }
        }>
          <div style={
            showEditor 
              ? { display: 'block', height: '100%' } 
              : { position: 'absolute', top: -9999, left: -9999, width: '100%', height: '100%', visibility: 'hidden', pointerEvents: 'none' }
          }>
            <EditorPage />
          </div>
          <div style={{ display: (!showEditor) ? 'flex' : 'none', flexDirection: 'column', height: '100%', position: 'relative', flex: 1, minHeight: 0 }}>
            {!showCanvas && <GlobalSearchbar />}
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
