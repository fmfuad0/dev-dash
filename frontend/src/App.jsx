import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { useSocket } from './hooks/useSocket.js';

import AppLayout from './components/Layout/AppLayout.jsx';
import ToastContainer from './components/UI/ToastContainer.jsx';
import { useUIStore } from './store/uiStore.js';

import LoginPage           from './pages/LoginPage.jsx';
import RegisterPage        from './pages/RegisterPage.jsx';
import DashboardPage       from './pages/DashboardPage.jsx';
import ArtifactsPage       from './pages/ArtifactsPage.jsx';
import ArtifactDetail      from './pages/ArtifactDetailPage.jsx';
import WorkspacesPage      from './pages/WorkspacesPage.jsx';
import SearchPage          from './pages/SearchPage.jsx';
import VaultPage           from './pages/VaultPage.jsx';
import ExplorerPage        from './pages/ExplorerPage.jsx';
import TerminalHistoryPage from './pages/TerminalPage.jsx';
import DevicesPage         from './pages/DevicesPage.jsx';
import SettingsPage        from './pages/SettingsPage.jsx';
import EditorPage          from './pages/EditorPage.jsx';
import GitPage             from './pages/GitPage.jsx';
import NotificationsPage   from './pages/NotificationsPage.jsx';
import CanvasPage          from './pages/CanvasPage.jsx';


function PrivateRoute({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return accessToken ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return accessToken ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  useSocket();

  return (
    <Routes>
      <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index                   element={<DashboardPage />} />
        <Route path="workspaces"       element={<WorkspacesPage />} />
        <Route path="artifacts"        element={<ArtifactsPage />} />
        <Route path="artifacts/:id"    element={<ArtifactDetail />} />
        <Route path="search"           element={<SearchPage />} />
        <Route path="explorer"         element={<ExplorerPage />} />
        <Route path="vault"            element={<VaultPage />} />
        <Route path="terminal-history" element={<TerminalHistoryPage />} />
        <Route path="editor"           element={<></>} />
        <Route path="git"              element={<GitPage />} />
        <Route path="devices"          element={<DevicesPage />} />
        <Route path="notifications"    element={<NotificationsPage />} />
        <Route path="canvas"           element={<CanvasPage />} />
        <Route path="settings"         element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Trigger Vite reload
export default function App() {
  const theme = useUIStore((s) => s.theme);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer />
    </BrowserRouter>
  );
}
