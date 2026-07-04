import React, { useEffect, useState } from 'react';
import { useGitStore } from '../../store/gitStore.js';
import { useIdeStore } from '../../store/ideStore.js';
import { GitBranch, GitCommit, ArrowDown, ArrowUp, RefreshCw, Plus, X, Code } from 'lucide-react';
import { toast } from '../../store/uiStore.js';

export default function LocalWorkspace() {
  const rootPath = useIdeStore((s) => s.rootPath);
  const { 
    localIsRepo, localStaged, localUnstaged, localCommits, localBranches, localCurrentBranch,
    loadLocalStatus, loadLocalLog, loadLocalBranches, localStage, localUnstage, localCommit, localBranchSwitch, localSync, localGetDiff 
  } = useGitStore();

  const [commitMsg, setCommitMsg] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [diffViewer, setDiffViewer] = useState(null);

  useEffect(() => {
    if (rootPath) {
      loadLocalStatus(rootPath);
      loadLocalLog(rootPath);
      loadLocalBranches(rootPath);
    }
  }, [rootPath]);

  if (!rootPath) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        Open a folder in the Editor to view the Local Git Workspace.
      </div>
    );
  }

  if (!localIsRepo) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ marginBottom: 16 }}>The current workspace is not a Git repository.</p>
        <button className="btn btn-primary" onClick={async () => {
           await fetch('http://localhost:5000/api/git/init', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ root: rootPath })
           });
           loadLocalStatus(rootPath);
        }}>Initialize Repository</button>
      </div>
    );
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return toast.error('Enter a commit message');
    await localCommit(rootPath, commitMsg);
    setCommitMsg('');
  };

  const openDiff = async (file, staged) => {
    const diff = await localGetDiff(rootPath, file, staged);
    setDiffViewer({ file, content: diff || 'No changes to display', staged });
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>
      
      {/* ── Left Column: Status & Commit ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'hidden' }}>
        
        {/* Status Panel */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.95rem' }}>
            Changes
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            
            {/* Staged */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-success)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                <span>Staged Changes ({localStaged.length})</span>
                {localStaged.length > 0 && <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => localUnstage(rootPath, ['.'])}>Unstage All</span>}
              </div>
              {localStaged.length === 0 ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No staged changes</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {localStaged.map(f => (
                    <div key={f.file} className="hover-bg-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--accent-success)', width: 14, fontWeight: 'bold' }}>{f.code}</span>
                      <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => openDiff(f.file, true)}>{f.file}</span>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => localUnstage(rootPath, [f.file])} title="Unstage"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unstaged */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-warning)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                <span>Unstaged Changes ({localUnstaged.length})</span>
                {localUnstaged.length > 0 && <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => localStage(rootPath, ['.'])}>Stage All</span>}
              </div>
              {localUnstaged.length === 0 ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No unstaged changes</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {localUnstaged.map(f => (
                    <div key={f.file} className="hover-bg-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--accent-warning)', width: 14, fontWeight: 'bold' }}>{f.code}</span>
                      <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => openDiff(f.file, false)}>{f.file}</span>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => localStage(rootPath, [f.file])} title="Stage"><Plus size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Commit Panel */}
        <div className="card" style={{ flexShrink: 0, padding: 12 }}>
          <textarea 
            className="input" 
            placeholder="Commit message" 
            style={{ width: '100%', height: 80, resize: 'none', marginBottom: 8 }}
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
          />
          <button className="btn btn-primary w-full" onClick={handleCommit} disabled={localStaged.length === 0} style={{ justifyContent: 'center' }}>
            Commit Staged
          </button>
        </div>
      </div>

      {/* ── Right Column: Branches & History ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'hidden' }}>
        
        {/* Branches & Sync */}
        <div className="card" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <GitBranch size={16} />
            <select className="select" style={{ flex: 1 }} value={localCurrentBranch} onChange={e => localBranchSwitch(rootPath, e.target.value)}>
              {localBranches.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input" style={{ flex: 1, height: 32 }} placeholder="New branch name" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              if (newBranchName) {
                await localBranchSwitch(rootPath, newBranchName, true);
                setNewBranchName('');
              }
            }}>Create</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => localSync(rootPath, 'pull')}><ArrowDown size={14} /> Pull</button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => localSync(rootPath, 'push')}><ArrowUp size={14} /> Push</button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => localSync(rootPath, 'fetch')}><RefreshCw size={14} /> Fetch</button>
          </div>
        </div>

        {/* Local History */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitCommit size={16} /> Commit History
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localCommits.length === 0 ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No commits yet</div> :
              localCommits.map(c => (
                <div key={c.hash} style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.message}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{c.author_name}</span>
                    <span style={{ color: 'var(--accent-primary)' }}>{c.hash.substring(0, 7)}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

      </div>

      {/* ── Diff Modal ── */}
      {diffViewer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: '80vw', height: '80vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
              <Code size={16} color="var(--accent-info)" />
              <div style={{ fontWeight: 600, flex: 1, fontSize: '0.95rem' }}>Diff: {diffViewer.file} {diffViewer.staged ? '(Staged)' : '(Unstaged)'}</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDiffViewer(null)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-base)' }}>
              <pre style={{ margin: 0, fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {diffViewer.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
