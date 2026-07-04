import React, { useState, useEffect } from 'react';
import { useIdeStore } from '../../store/ideStore';
import api from '../../api/client';
import { toast } from '../../store/uiStore';
import { Plus, Minus, Check, GitCommit, RefreshCw } from 'lucide-react';

export default function SourceControlPanel() {
  const rootPath = useIdeStore((s) => s.rootPath);
  const [staged, setStaged] = useState([]);
  const [unstaged, setUnstaged] = useState([]);
  const [isRepo, setIsRepo] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const res = await api.get('/git/status', { params: { root: rootPath } });
      if (!res.data.isRepo) {
        setIsRepo(false);
      } else {
        setIsRepo(true);
        setStaged(res.data.staged || []);
        setUnstaged(res.data.unstaged || []);
      }
    } catch (err) {
      toast.error('Failed to get git status');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, [rootPath]);

  const handleStage = async (file) => {
    try {
      await api.post('/git/add', { root: rootPath, files: [file] });
      fetchStatus();
    } catch { toast.error('Failed to stage file'); }
  };

  const handleStageAll = async () => {
    try {
      await api.post('/git/add', { root: rootPath, files: ['.'] });
      fetchStatus();
    } catch { toast.error('Failed to stage all'); }
  };

  const handleUnstage = async (file) => {
    try {
      await api.post('/git/restore', { root: rootPath, files: [file] });
      fetchStatus();
    } catch { toast.error('Failed to unstage file'); }
  };

  const handleCommit = async () => {
    if (!message.trim()) { toast.error('Commit message required'); return; }
    try {
      await api.post('/git/commit', { root: rootPath, message });
      setMessage('');
      fetchStatus();
      toast.success('Committed successfully');
    } catch { toast.error('Commit failed'); }
  };

  const handleInit = async () => {
    try {
      await api.post('/git/init', { root: rootPath });
      toast.success('Repository initialized');
      fetchStatus();
    } catch {
      toast.error('Failed to initialize repository');
    }
  };

  if (!isRepo) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="vsc-sidebar-title">SOURCE CONTROL</div>
        <div style={{ padding: '20px', color: '#858585', fontSize: '13px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span>Not a git repository</span>
          <button 
            onClick={handleInit}
            style={{ 
              background: '#0e639c', color: 'white', border: 'none', 
              padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderRadius: 2,
            }}
          >
            Initialize Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="vsc-sidebar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>SOURCE CONTROL</span>
        <button onClick={fetchStatus} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }} title="Refresh">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ padding: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (Ctrl+Enter to commit)"
            style={{ 
              width: '100%', minHeight: '60px', background: '#3c3c3c', color: '#cccccc', 
              border: '1px solid #3c3c3c', padding: '6px', borderRadius: '2px', outline: 'none', resize: 'vertical'
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') handleCommit();
            }}
          />
          <button 
            onClick={handleCommit}
            disabled={staged.length === 0}
            style={{ 
              width: '100%', background: '#0e639c', color: 'white', border: 'none', 
              padding: '4px', cursor: staged.length > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', borderRadius: 2,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, opacity: staged.length > 0 ? 1 : 0.5
            }}
          >
            <Check size={14} /> Commit
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', marginTop: 10 }}>
        {staged.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', color: '#cccccc', display: 'flex', justifyContent: 'space-between' }}>
              <span>STAGED CHANGES</span>
              <button onClick={() => handleUnstage('.')} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }} title="Unstage All"><Minus size={12} /></button>
            </div>
            {staged.map((item) => (
              <div key={item.file} style={{ padding: '2px 10px 2px 24px', fontSize: '13px', color: '#cccccc', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                   onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
                   onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{item.file}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ color: '#89d185' }}>{item.code}</span>
                  <button onClick={() => handleUnstage(item.file)} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }}><Minus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', color: '#cccccc', display: 'flex', justifyContent: 'space-between' }}>
            <span>CHANGES</span>
            <button onClick={handleStageAll} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }} title="Stage All"><Plus size={12} /></button>
          </div>
          {unstaged.length === 0 ? (
            <div style={{ padding: '4px 24px', fontSize: '12px', color: '#858585' }}>No changes</div>
          ) : (
            unstaged.map((item) => (
              <div key={item.file} style={{ padding: '2px 10px 2px 24px', fontSize: '13px', color: '#cccccc', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                   onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
                   onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{item.file}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ color: '#cca700' }}>{item.code}</span>
                  <button onClick={() => handleStage(item.file)} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }}><Plus size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
