import React, { useState, useEffect, useMemo } from 'react';
import { Github, Key, User, Search, LogOut, GitFork, Star, Eye, GitPullRequest, AlertCircle, RefreshCw, Download, FolderOpen, ExternalLink, ChevronLeft, Plus, File, Folder, GitCommit, Code, X } from 'lucide-react';
import { useGitStore } from '../store/gitStore.js';
import { useIdeStore } from '../store/ideStore.js';
import { useNavigate } from 'react-router-dom';
import { toast, useUIStore } from '../store/uiStore.js';
import { vaultApi } from '../api/index.js';
import api from '../api/client.js';
import LocalWorkspace from '../components/Git/LocalWorkspace.jsx';

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572a5',
  Java: '#b07219', 'C#': '#178600', Go: '#00add8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4f5d95', CSS: '#563d7c', HTML: '#e34c26',
  Swift: '#ffac45', Kotlin: '#f18e33', Shell: '#89e051',
};

export default function GitPage() {
  const navigate = useNavigate();
  const { pat, user, repos, loading, selectedRepo, repoBranches, repoPRs, repoIssues, repoContents, currentRepoBranch,
    setPat, logout, loadProfile, selectRepo, switchBranch, fetchFileContent, fetchCommits } = useGitStore();
  const setRootPath = useIdeStore((s) => s.setRootPath);
  const lastOpenedPath = useUIStore((s) => s.lastOpenedPath);
  const setLastOpenedPath = useUIStore((s) => s.setLastOpenedPath);

  const [patInput, setPatInput] = useState(pat);
  const [fileViewer, setFileViewer] = useState(null);
  const [commits, setCommits] = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [showCommits, setShowCommits] = useState(false);
  const [cloneDialog, setCloneDialog] = useState(null); // repo object
  const [cloneDir, setCloneDir] = useState('');
  const [cloning, setCloning] = useState(false);
  const [issueDialog, setIssueDialog] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [publicRepoInput, setPublicRepoInput] = useState('');
  const [vaultTokens, setVaultTokens] = useState([]);
  const [selectedVaultId, setSelectedVaultId] = useState('');
  const [viewMode, setViewMode] = useState('remote'); // 'remote' or 'local'

  const [newRemoteBranchName, setNewRemoteBranchName] = useState('');
  const [remoteCommitMsg, setRemoteCommitMsg] = useState('');
  const [remoteFileContent, setRemoteFileContent] = useState('');
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [fileCommitLoading, setFileCommitLoading] = useState(false);
  const [isNewFile, setIsNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Fetch vault items for API tokens on mount
  useEffect(() => {
    async function loadVault() {
      try {
        const res = await vaultApi.list({});
        // Filter out things that are definitely not Github tokens
        const tokens = res.items?.filter(item => item.vaultType === 'api-token' || item.vaultType === 'env' || item.vaultType === 'generic') || [];
        setVaultTokens(tokens);
      } catch (e) {
        console.error('Failed to load vault items', e);
      }
    }
    loadVault();
  }, []);

  const handlePatSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVaultId) {
      toast.error('Please select a Vault token');
      return;
    }
    try {
      const fullItem = await vaultApi.get(selectedVaultId);
      if (fullItem?.item?.secretEnvelope?.ciphertext) {
        // Decode our phase-2 mock encryption
        const tokenValue = atob(fullItem.item.secretEnvelope.ciphertext);
        setPat(tokenValue);
        loadProfile();
      } else {
        toast.error('Invalid vault item format');
      }
    } catch (err) {
      toast.error('Failed to retrieve vault item');
    }
  };
  useEffect(() => {
    setCurrentPath('');
    setFileViewer(null);
    setShowCommits(false);
    setCommits([]);
  }, [selectedRepo?.id, currentRepoBranch]);

  const visibleFiles = useMemo(() => {
    if (!repoContents || !Array.isArray(repoContents)) return [];
    const prefix = currentPath ? `${currentPath}/` : '';
    const items = repoContents.filter(item => {
      if (!item.path.startsWith(prefix)) return false;
      const rest = item.path.substring(prefix.length);
      return !rest.includes('/');
    });
    return items.sort((a, b) => {
      if (a.type === 'tree' && b.type !== 'tree') return -1;
      if (a.type !== 'tree' && b.type === 'tree') return 1;
      return a.path.localeCompare(b.path);
    });
  }, [repoContents, currentPath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setPat(urlToken);
      window.history.replaceState({}, document.title, '/git');
    }
  }, []);

  useEffect(() => {
    if (pat && !user) loadProfile();
  }, [pat]);

  const loadCommits = async () => {
    if (showCommits) { setShowCommits(false); return; }
    setCommitsLoading(true);
    setShowCommits(true);
    const data = await fetchCommits();
    setCommits(data);
    setCommitsLoading(false);
  };

  const openFile = async (path) => {
    const data = await fetchFileContent(path);
    if (data) {
      setFileViewer(data);
      setRemoteFileContent(data.content);
      setIsEditingFile(false);
      setIsNewFile(false);
      setRemoteCommitMsg('');
      setNewFileName('');
    }
  };

  const openNewFileEditor = () => {
    setFileViewer({ name: 'New File', html_url: '', download_url: '', content: '' });
    setRemoteFileContent('');
    setIsEditingFile(true);
    setIsNewFile(true);
    setRemoteCommitMsg('');
    setNewFileName('');
  };

  const handleRemoteCommit = async () => {
    if (!remoteCommitMsg.trim()) { toast.error('Enter a commit message'); return; }
    if (isNewFile && !newFileName.trim()) { toast.error('Enter a file name'); return; }
    
    setFileCommitLoading(true);
    
    const filePath = isNewFile 
      ? (currentPath ? `${currentPath}/${newFileName}` : newFileName) 
      : fileViewer.path;

    const success = await useGitStore.getState().commitRemoteFile(
      filePath, 
      remoteFileContent, 
      remoteCommitMsg, 
      isNewFile ? undefined : fileViewer.sha
    );
    
    setFileCommitLoading(false);
    if (success) {
      setFileViewer(null);
    }
  };

  const handleClone = async () => {
    if (!cloneDir.trim()) { toast.error('Enter a target directory'); return; }
    setCloning(true);
    try {
      const res = await api.post('/git/clone', { repoUrl: cloneDialog.clone_url, targetDir: cloneDir });
      toast.success(res.data.message);
      setCloneDialog(null);
      // Offer to open in editor
      if (window.confirm('Open cloned repository in IDE?')) {
        setRootPath(res.data.clonedPath);
        navigate('/editor');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Clone failed');
    } finally { setCloning(false); }
  };

  const handlePickFolder = async () => {
    try {
      const res = await api.get('/fs/pick-folder', { params: { defaultPath: lastOpenedPath || '' } });
      if (res.data.path) {
        setCloneDir(res.data.path);
        setLastOpenedPath(res.data.path);
      }
    } catch (err) {
      toast.error('Failed to open folder picker');
    }
  };

  const handleCreateIssue = async () => {
    if (!issueTitle.trim()) { toast.error('Issue title required'); return; }
    await useGitStore.getState().createIssue(issueTitle, issueBody);
    setIssueDialog(false); setIssueTitle(''); setIssueBody('');
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Github size={20} />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Git Operations</h1>
        </div>
        <div style={{ flex: 1 }} />



        {/* PAT / Auth */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={user.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>@{user.login}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); setPatInput(''); }} style={{ color: 'var(--accent-danger)' }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        ) : (
          <form onSubmit={handlePatSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Key size={14} color="var(--text-muted)" />
              <select className="select" style={{ width: 200, fontSize: '0.85rem' }} value={selectedVaultId} onChange={(e) => setSelectedVaultId(e.target.value)}>
                <option value="">Select Vault Item...</option>
                {vaultTokens.map(t => (
                  <option key={t._id} value={t._id}>{t.title}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary btn-sm">Connect</button>
              <a href="http://localhost:5000/api/auth/github/login" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Github size={14} /> OAuth
              </a>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> For safety pasting is disabled. Create an env variable in Vault, then import here.
            </div>
          </form>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '0 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div 
            style={{ padding: '8px 4px', cursor: 'pointer', borderBottom: `2px solid ${viewMode === 'remote' ? 'var(--accent-primary)' : 'transparent'}`, color: viewMode === 'remote' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: viewMode === 'remote' ? 600 : 400 }}
            onClick={() => setViewMode('remote')}
          >
            Remote Explorer
          </div>
          <div 
            style={{ padding: '8px 4px', cursor: 'pointer', borderBottom: `2px solid ${viewMode === 'local' ? 'var(--accent-primary)' : 'transparent'}`, color: viewMode === 'local' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: viewMode === 'local' ? 600 : 400 }}
            onClick={() => setViewMode('local')}
          >
            Local Workspace
          </div>
        </div>

        {viewMode === 'local' ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LocalWorkspace />
          </div>
        ) : (
          /* ── Profile Tab ── */
          <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden', padding: '0 16px' }}>

            {/* Left: profile + repo list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: selectedRepo ? '40%' : '100%', overflow: 'auto', transition: 'width 0.2s' }}>
              {user && (
                <div className="card" style={{ 
                  display: 'flex', gap: 20, alignItems: 'flex-start', padding: 24, 
                  background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(30,30,46,0.5) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ position: 'relative' }}>
                    <img src={user.avatar_url} alt="" style={{ width: 84, height: 84, borderRadius: '50%', flexShrink: 0, border: '2px solid var(--accent-primary)', padding: 2, background: 'var(--bg-base)' }} />
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, background: 'var(--accent-success)', borderRadius: '50%', border: '2px solid var(--bg-elevated)' }} title="Online" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {user.name || user.login}
                      <a href={user.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}><ExternalLink size={14} /></a>
                    </div>
                    <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: 12, fontWeight: 500 }}>@{user.login}</div>
                    {user.bio && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>{user.bio}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', width: '100%', overflowX: 'auto', paddingBottom: 4 }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: 16, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        <FolderOpen size={12} color="var(--accent-info)" /> <strong>{user.public_repos}</strong> <span style={{ color: 'var(--text-muted)' }}>Repos</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: 16, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        <User size={12} color="var(--accent-success)" /> <strong>{user.followers}</strong> <span style={{ color: 'var(--text-muted)' }}>Followers</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: 16, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        <User size={12} color="var(--accent-warning)" /> <strong>{user.following}</strong> <span style={{ color: 'var(--text-muted)' }}>Following</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={loadProfile} title="Refresh" disabled={loading} style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  </button>
                </div>
              )}

                {/* Repo list */}
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                  
                  {/* Public Repo Explorer */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explore Any Repository</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        style={{ flex: 1, height: 32, fontSize: '0.85rem' }}
                        placeholder="owner/repo or URL"
                        value={publicRepoInput}
                        onChange={(e) => setPublicRepoInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && publicRepoInput.trim()) {
                            const success = await useGitStore.getState().openPublicRepo(publicRepoInput);
                            if (success) setPublicRepoInput('');
                          }
                        }}
                      />
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ height: 32 }}
                        onClick={async () => {
                          if (publicRepoInput.trim()) {
                            const success = await useGitStore.getState().openPublicRepo(publicRepoInput);
                            if (success) setPublicRepoInput('');
                          }
                        }}
                      >
                        <Search size={14} /> Open
                      </button>
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.95rem', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderOpen size={16} color="var(--text-muted)" /> Your Repositories <span className="badge badge-default" style={{ fontSize: '0.75rem', borderRadius: 12 }}>{repos.length}</span>
                  </div>
                {!user && (
                  <div className="empty-state" style={{ margin: 32 }}>
                    <User size={48} color="var(--border-subtle)" style={{ marginBottom: 16 }} />
                    <div style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-secondary)' }}>Connect your GitHub account to view repositories</div>
                    <a href="http://localhost:5000/api/auth/github/login" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Github size={16} /> Log in with GitHub
                    </a>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', padding: 12, gap: 10 }}>
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => selectRepo(repo)}
                      style={{
                        padding: 16, 
                        border: `1px solid ${selectedRepo?.id === repo.id ? 'var(--accent-primary)' : 'transparent'}`,
                        borderRadius: 12, cursor: 'pointer', 
                        background: selectedRepo?.id === repo.id ? 'rgba(0, 122, 204, 0.08)' : 'var(--bg-base)',
                        boxShadow: selectedRepo?.id === repo.id ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      className="hover-bg-subtle"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', transition: 'color 0.2s' }} className="repo-name">{repo.name}</span>
                        {repo.private && <span className="badge badge-default" style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Private</span>}
                        {repo.fork && <span className="badge badge-default" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}><GitFork size={10} /> Fork</span>}
                      </div>
                      {repo.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{repo.description}</div>}
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {repo.language && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: LANG_COLORS[repo.language] || '#8b949e', display: 'inline-block', boxShadow: '0 0 4px rgba(0,0,0,0.2)' }} />
                            <span style={{ fontWeight: 500 }}>{repo.language}</span>
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Stars"><Star size={12} color="var(--accent-warning)" /> {repo.stargazers_count}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Forks"><GitFork size={12} color="var(--accent-info)" /> {repo.forks_count}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>
                          Updated {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: '0.8rem', padding: '6px 0' }}
                          onClick={() => { setCloneDialog(repo); setCloneDir(''); }}>
                          <Download size={13} /> Clone Repo
                        </button>
                        <a href={repo.html_url} target="_blank" rel="noreferrer"
                          className="btn btn-secondary btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: '0.8rem', padding: '6px 0', textDecoration: 'none' }}>
                          <ExternalLink size={13} /> View on GitHub
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: repo detail */}
            {selectedRepo && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', minWidth: 0 }}>
                <div className="card" style={{ flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => useGitStore.getState().selectRepo(null)}>
                      <ChevronLeft size={16} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedRepo.full_name}</h2>
                    <a href={selectedRepo.html_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon"><ExternalLink size={14} /></a>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-primary btn-sm" onClick={() => { setCloneDialog(selectedRepo); setCloneDir(''); }}>
                      <Download size={13} /> Clone
                    </button>
                  </div>
                  {selectedRepo.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>{selectedRepo.description}</p>}
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>⭐ {selectedRepo.stargazers_count} stars</span>
                    <span>🔀 {selectedRepo.forks_count} forks</span>
                    <span>👁 {selectedRepo.watchers_count} watching</span>
                    {selectedRepo.language && <span>• {selectedRepo.language}</span>}
                  </div>
                </div>

                {/* File Explorer */}
                <div className="card" style={{ flexShrink: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Folder size={16} color="var(--accent-info)" /> Files
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary btn-sm" onClick={openNewFileEditor} disabled={commitsLoading || loading}>
                      <Plus size={14} /> New File
                    </button>
                  </div>
                  <div style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                    <span style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={() => setCurrentPath('')}>
                      {selectedRepo.name}
                    </span>
                    {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
                      <React.Fragment key={idx}>
                        <span>/</span>
                        <span 
                          style={{ cursor: idx === arr.length - 1 ? 'default' : 'pointer', color: idx === arr.length - 1 ? 'var(--text-primary)' : 'var(--accent-primary)' }}
                          onClick={() => {
                            if (idx < arr.length - 1) {
                              setCurrentPath(arr.slice(0, idx + 1).join('/'));
                            }
                          }}
                        >
                          {part}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ maxHeight: 300, overflow: 'auto' }}>
                    {visibleFiles.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {repoContents.length === 0 ? 'Loading repository contents or repository is empty...' : 'Folder is empty'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {currentPath !== '' && (
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}
                            onClick={() => {
                              const parts = currentPath.split('/');
                              parts.pop();
                              setCurrentPath(parts.join('/'));
                            }}
                            className="hover-bg-subtle"
                          >
                            <Folder size={14} color="var(--accent-info)" />
                            <span>..</span>
                          </div>
                        )}
                        {visibleFiles.map(file => {
                          const isDir = file.type === 'tree';
                          const fileName = file.path.split('/').pop();
                          return (
                            <div 
                              key={file.path} 
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}
                              onClick={() => {
                                if (isDir) setCurrentPath(file.path);
                                else openFile(file.path);
                              }}
                              className="hover-bg-subtle"
                            >
                              {isDir ? <Folder size={14} color="var(--accent-info)" /> : <File size={14} color="var(--text-muted)" />}
                              <span style={{ color: isDir ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{fileName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Branches & Commits */}
                <div className="card" style={{ flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Branch:</div>
                    <select className="select" style={{ width: 160, padding: '4px 8px' }} value={currentRepoBranch} onChange={(e) => switchBranch(e.target.value)}>
                      {repoBranches.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input className="input" style={{ flex: 1, height: 32 }} placeholder="New branch name" value={newRemoteBranchName} onChange={e => setNewRemoteBranchName(e.target.value)} />
                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                      if (newRemoteBranchName) {
                        const success = await useGitStore.getState().createRemoteBranch(newRemoteBranchName);
                        if (success) setNewRemoteBranchName('');
                      }
                    }}>Create</button>
                  </div>
                  <button className="btn btn-secondary btn-sm w-full" onClick={loadCommits} style={{ justifyContent: 'center' }}>
                    <GitCommit size={14} /> {showCommits ? 'Hide Commits' : 'View Recent Commits'}
                  </button>
                  
                  {showCommits && (
                    <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {commitsLoading ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading...</div> : 
                        commits.map(c => (
                          <div key={c.sha} style={{ fontSize: '0.8rem', padding: 8, background: 'var(--bg-elevated)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.commit.message}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{c.commit.author.name}</span>
                              <a href={c.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{c.sha.substring(0, 7)}</a>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* PRs */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <GitPullRequest size={16} color="var(--accent-success)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Open Pull Requests ({repoPRs.length})</span>
                  </div>
                  {repoPRs.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No open PRs</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {repoPRs.map((pr) => (
                        <div key={pr.id} style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>#{pr.number} {pr.title}</span>
                            <a href={pr.html_url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            by @{pr.user.login} • {pr.head.ref} → {pr.base.ref}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Issues */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <AlertCircle size={16} color="var(--accent-warning)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Open Issues ({repoIssues.length})</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-primary btn-sm" onClick={() => setIssueDialog(true)}><Plus size={12} /> New Issue</button>
                  </div>
                  {repoIssues.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No open issues</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {repoIssues.map((issue) => (
                        <div key={issue.id} style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>#{issue.number} {issue.title}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>by @{issue.user.login}</div>
                          </div>
                          <a href={issue.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Clone Dialog ── */}
      {cloneDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: 480, padding: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: '1.05rem' }}>Clone — {cloneDialog.full_name}</h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>URL: {cloneDialog.clone_url}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 6, marginTop: 16 }}>Target directory (on your machine):</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="e.g. C:/Users/YourName/Projects"
                value={cloneDir}
                onChange={(e) => setCloneDir(e.target.value)}
                autoFocus
              />
              <button className="btn btn-secondary" onClick={handlePickFolder} type="button">
                <FolderOpen size={14} /> Browse...
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setCloneDialog(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleClone} disabled={cloning}>
                {cloning ? 'Cloning…' : 'Clone Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Issue Dialog ── */}
      {issueDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: 500, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>New Issue — {selectedRepo?.name}</h3>
            <input className="input" style={{ width: '100%', marginBottom: 10 }} placeholder="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} autoFocus />
            <textarea className="input" style={{ width: '100%', height: 120, resize: 'vertical', marginBottom: 16 }} placeholder="Description (optional)" value={issueBody} onChange={(e) => setIssueBody(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setIssueDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateIssue}>Submit Issue</button>
            </div>
          </div>
        </div>
      )}

      {/* ── File Viewer Dialog ── */}
      {fileViewer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: '80vw', height: '80vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
              <Code size={16} color="var(--accent-info)" />
              {isNewFile ? (
                <input 
                  className="input" 
                  style={{ flex: 1, height: 32 }} 
                  placeholder="Filename (e.g. src/index.js)" 
                  value={newFileName} 
                  onChange={e => setNewFileName(e.target.value)} 
                />
              ) : (
                <div style={{ fontWeight: 600, flex: 1, fontSize: '0.95rem' }}>{fileViewer.name}</div>
              )}
              {!isNewFile && (
                <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingFile(!isEditingFile)}>
                  {isEditingFile ? 'Cancel Edit' : 'Edit File'}
                </button>
              )}
              {fileViewer.html_url && <a href={fileViewer.html_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon"><ExternalLink size={14} /></a>}
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFileViewer(null)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
                {!isEditingFile && /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(fileViewer.name) ? (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img src={fileViewer.download_url} alt={fileViewer.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : isEditingFile ? (
                  <textarea
                    style={{ flex: 1, width: '100%', border: 'none', resize: 'none', padding: 16, background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none' }}
                    value={remoteFileContent}
                    onChange={e => setRemoteFileContent(e.target.value)}
                  />
                ) : (
                  <pre style={{ margin: 0, padding: 16, fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {fileViewer.content}
                  </pre>
                )}
            </div>
            {isEditingFile && (
              <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, alignItems: 'center' }}>
                <input 
                  className="input" 
                  style={{ flex: 1 }} 
                  placeholder="Commit message..." 
                  value={remoteCommitMsg} 
                  onChange={e => setRemoteCommitMsg(e.target.value)} 
                />
                <button className="btn btn-primary" onClick={handleRemoteCommit} disabled={fileCommitLoading}>
                  {fileCommitLoading ? 'Committing...' : 'Commit Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
