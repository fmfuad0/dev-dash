import React from 'react';
import { useUIStore } from '../store/uiStore.js';
import { Bell, AlertCircle, Info, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';

export default function NotificationsPage() {
  const notificationHistory = useUIStore((s) => s.notificationHistory) || [];
  const clearHistory = useUIStore((s) => s.clearNotificationHistory);

  const getIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle size={20} color="var(--accent-danger)" />;
      case 'warning': return <AlertTriangle size={20} color="var(--accent-warning)" />;
      case 'success': return <CheckCircle size={20} color="var(--accent-success)" />;
      default: return <Info size={20} color="var(--accent-info)" />;
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
        <Bell size={20} />
        <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>System Notifications</h1>
        <div style={{ flex: 1 }} />
        {notificationHistory.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={clearHistory}>
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {notificationHistory.length === 0 ? (
            <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Bell size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div>No new notifications</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              {notificationHistory.map((notif, idx) => (
                <div 
                  key={notif.id || idx}
                  style={{
                    padding: 16, 
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', 
                    gap: 16,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    alignItems: 'flex-start'
                  }}
                  className="hover-bg-subtle"
                >
                  <div style={{ paddingTop: 2 }}>
                    {getIcon(notif.type)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <span style={{ lineHeight: 1.5 }}>{notif.message}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {notif.timestamp ? new Date(notif.timestamp).toLocaleString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
