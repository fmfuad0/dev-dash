import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore.js';

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const COLORS = {
  success: 'var(--accent-success)',
  error:   'var(--accent-danger)',
  warning: 'var(--accent-warning)',
  info:    'var(--accent-info)',
};

function Toast({ id, type = 'info', message, duration = 4000 }) {
  const removeToast = useUIStore((s) => s.removeToast);
  const Icon = ICONS[type] || Info;

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, removeToast]);

  return (
    <div className={`toast toast-${type}`}>
      <Icon size={16} style={{ color: COLORS[type], flexShrink: 0 }} />
      <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
        {message}
      </span>
      <button
        onClick={() => removeToast(id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, display: 'flex',
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="toast-container">
      {toasts.map((t) => <Toast key={t.id} {...t} />)}
    </div>
  );
}
