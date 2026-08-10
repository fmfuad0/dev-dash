import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Server, Plus, Folder, File, RefreshCw, Trash2, Edit2, ChevronRight, Check, X, MoreVertical, Download, Copy, Grid as GridIcon, List as ListIcon, PowerOff, ClipboardPaste } from 'lucide-react';
import api from '../api/client.js';
import { toast } from '../store/uiStore.js';
import ServerConnectionModal from '../components/Explorer/ServerConnectionModal.jsx';
import { formatDistanceToNow } from 'date-fns';
import { useIdeStore } from '../store/ideStore.js';

export default function ExplorerPage() {
  const qc = useQueryClient();
  const [showAddServer, setShowAddServer] = useState(false);
  const [editConnectionData, setEditConnectionData] = useState(null);
  const [activeProvider, setActiveProvider] = useState('local'); // 'local' or 'remote'
  const [activeConnectionId, setActiveConnectionId] = useState(null);
  const [currentPath, setCurrentPath] = useState(activeProvider === 'local' ? '/' : '.');
  
  const [viewMode, setViewMode] = useState('grid');
  const [clipboard, setClipboard] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openConnDropdown, setOpenConnDropdown] = useState(null);

  const openFile = useIdeStore(s => s.openFile);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = () => { setOpenDropdown(null); setOpenConnDropdown(null); };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Fetch remote connections
  const { data: connectionsData } = useQuery({
    queryKey: ['remote_connections'],
    queryFn: () => api.get('/remote/connections').then(r => r.data)
  });
  const connections = connectionsData?.connections || [];

  // Fetch folder contents
  const { data: folderData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['fs', activeProvider, activeConnectionId, currentPath],
    queryFn: () => api.get('/fs/list', { 
      params: { 
        provider: activeProvider, 
        connectionId: activeConnectionId, 
        dir: currentPath 
      } 
    }).then(r => r.data)
  });

  const deleteMutation = useMutation({
    mutationFn: (targetPath) => api.delete('/fs/delete', {
      data: { targetPath, provider: activeProvider, connectionId: activeConnectionId }
    }),
    onSuccess: () => {
      toast.success('Deleted successfully');
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete')
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldPath, newPath }) => api.post('/fs/rename', {
      oldPath, newPath, provider: activeProvider, connectionId: activeConnectionId
    }),
    onSuccess: () => {
      toast.success('Renamed successfully');
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to rename')
  });

  const copyMutation = useMutation({
    mutationFn: ({ targetPath }) => api.post('/fs/copy', {
      sourcePath: clipboard.path,
      sourceProvider: clipboard.provider,
      sourceConnectionId: clipboard.connectionId,
      targetPath,
      targetProvider: activeProvider,
      targetConnectionId: activeConnectionId
    }),
    onSuccess: () => {
      toast.success('Copied successfully');
      setClipboard(null);
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to copy')
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id) => api.delete(`/remote/connections/${id}`),
    onSuccess: () => {
      toast.success('Connection deleted');
      qc.invalidateQueries(['remote_connections']);
      if (activeConnectionId === deleteConnectionMutation.variables) {
        handleLocalClick();
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete connection')
  });

  const handleNavigate = (path, isDirectory) => {
    if (isDirectory) {
      setCurrentPath(path);
    } else {
      handleDownload(path);
    }
  };

  const handleDownload = async (path) => {
    try {
      toast.success('Downloading...');
      const res = await api.get('/fs/read', {
        params: {
          file: path,
          provider: activeProvider,
          connectionId: activeConnectionId || undefined
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', path.split('/').pop());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download file');
      console.error(err);
    }
  };

  const handleRename = (path, currentName) => {
    const newName = window.prompt('Enter new name:', currentName);
    if (!newName || newName === currentName) return;
    
    const parts = path.split('/');
    parts.pop();
    const newPath = (parts.length ? parts.join('/') : (activeProvider === 'local' ? 'C:/' : '')) + '/' + newName;
    
    renameMutation.mutate({ oldPath: path, newPath });
  };

  const handleCopy = (item) => {
    setClipboard({
      path: item.path,
      name: item.name,
      provider: activeProvider,
      connectionId: activeConnectionId
    });
    toast.success('Copied to clipboard');
  };

  const handlePaste = () => {
    if (!clipboard) return;
    const destPath = currentPath === '/' || currentPath === '.' 
      ? currentPath + (currentPath === '/' ? '' : '/') + clipboard.name
      : currentPath + '/' + clipboard.name;
    copyMutation.mutate({ targetPath: destPath });
  };

  const handleDelete = (path, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteMutation.mutate(path);
    }
  };

  // Switch to Local Storage
  const handleLocalClick = () => {
    setActiveProvider('local');
    setActiveConnectionId(null);
    setCurrentPath('/');
  };

  // Switch to a Remote Server
  const handleRemoteClick = (connId) => {
    setActiveProvider('remote');
    setActiveConnectionId(connId);
    setCurrentPath('.');
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'row', gap: '20px', padding: 0, paddingTop: '75px', height: '100%', boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Storages</h2>
          <div 
            onClick={handleLocalClick}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', 
              borderRadius: '6px', cursor: 'pointer',
              background: activeProvider === 'local' ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text-color)',
              opacity: activeProvider === 'local' ? 1 : 0.7
            }}
          >
            <HardDrive size={18} />
            <span>Local Machine</span>
          </div>

          <h2 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Remote Servers
            <button className="btn btn-icon" onClick={() => setShowAddServer(true)}>
              <Plus size={14} />
            </button>
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {connections.map(conn => {
              const isActive = activeConnectionId === conn._id;
              return (
                <div 
                  key={conn._id}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', 
                    borderRadius: '6px', cursor: 'pointer',
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-color)',
                    opacity: isActive ? 1 : 0.7
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }} onClick={() => handleRemoteClick(conn._id)}>
                    <Server size={18} />
                    <span>{conn.name}</span>
                    {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-success)', marginLeft: 'auto' }} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isActive && (
                      <button className="btn btn-icon" onClick={(e) => { e.stopPropagation(); handleLocalClick(); }} title="Disconnect" style={{ color: 'var(--accent-danger)' }}>
                        <PowerOff size={14} style={{ color: 'red' }} />
                      </button>
                    )}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn btn-icon" 
                        onClick={(e) => { e.stopPropagation(); setOpenConnDropdown(conn._id); }}
                      >
                        <MoreVertical size={14} style={{ color: 'var(--accent-primary)' }} />
                      </button>
                      
                      {openConnDropdown === conn._id && (
                        <div 
                          style={{
                            position: 'absolute', right: 0, top: '24px', background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 10,
                            boxShadow: 'var(--shadow-md)', minWidth: '120px', display: 'flex', flexDirection: 'column',
                            padding: '4px'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button className="dropdown-item" onClick={() => { setEditConnectionData(conn); setShowAddServer(true); setOpenConnDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="dropdown-item" onClick={() => { deleteConnectionMutation.mutate(conn._id); setOpenConnDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--accent-danger)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {connections.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px' }}>
                No servers configured.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Breadcrumbs */}
          <button className="btn btn-icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', flex: 1 }}>
            <span 
              onClick={() => setCurrentPath(activeProvider === 'local' ? '/' : '.')}
              style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
            >
              {activeProvider === 'local' ? 'Root' : 'Home'}
            </span>
            {pathParts.map((part, i) => {
              const p = '/' + pathParts.slice(0, i + 1).join('/');
              return (
                <React.Fragment key={p}>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  <span 
                    onClick={() => setCurrentPath(p)}
                    style={{ cursor: 'pointer', color: i === pathParts.length - 1 ? 'var(--text-color)' : 'var(--accent-primary)' }}
                  >
                    {part}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {clipboard && (
              <button className="btn btn-secondary" onClick={handlePaste} title={`Paste ${clipboard.name}`}>
                <ClipboardPaste size={14} /> Paste
              </button>
            )}
            
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              <button 
                style={{ padding: '6px', background: viewMode === 'grid' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                onClick={() => setViewMode('grid')}
              >
                <GridIcon size={14} />
              </button>
              <button 
                style={{ padding: '6px', background: viewMode === 'list' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)', borderLeft: '1px solid var(--border-color)' }}
                onClick={() => setViewMode('list')}
              >
                <ListIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {isLoading && !folderData && !isError && <div>Loading folder contents...</div>}
          {isError && (
            <div style={{ color: 'var(--accent-danger)', padding: '20px', border: '1px solid var(--accent-danger)', borderRadius: '8px', background: 'rgba(255,0,0,0.1)' }}>
              <strong>Error connecting to remote server:</strong><br/>
              {error?.response?.data?.error || error.message}
            </div>
          )}
          
          {folderData?.items && (
            <div style={
              viewMode === 'grid' 
                ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }
                : { display: 'flex', flexDirection: 'column', gap: '5px' }
            }>
              {/* Up directory button if not at root */}
              {currentPath !== '/' && currentPath !== '.' && (
                <div 
                  onClick={() => {
                    const parts = currentPath.split('/').filter(Boolean);
                    parts.pop();
                    setCurrentPath(parts.length ? '/' + parts.join('/') : (activeProvider === 'local' ? '/' : '.'));
                  }}
                  style={{
                    padding: viewMode === 'grid' ? '15px' : '10px', 
                    borderRadius: '8px', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    background: 'var(--bg-secondary)'
                  }}
                >
                  <Folder size={24} style={{ color: 'var(--accent-primary)' }} />
                  <span>..</span>
                </div>
              )}
              
              {folderData.items.map(item => (
                <div 
                  key={item.path}
                  onClick={() => handleNavigate(item.path, item.isDirectory)}
                  className="fs-item-card"
                  style={{
                    padding: viewMode === 'grid' ? '15px' : '10px', 
                    borderRadius: '8px', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {item.isDirectory ? (
                    <Folder size={viewMode === 'grid' ? 24 : 18} style={{ color: 'var(--accent-warning)' }} />
                  ) : (
                    <File size={viewMode === 'grid' ? 24 : 18} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: viewMode === 'grid' ? '14px' : '13px' }}>
                    {item.name}
                  </span>
                  
                  <div className="fs-item-actions" style={{ position: 'absolute', right: '10px', display: 'flex', gap: '5px' }}>
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn btn-icon" 
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(item.path); }}
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {openDropdown === item.path && (
                        <div 
                          style={{
                            position: 'absolute', right: 0, top: '24px', background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 10,
                            boxShadow: 'var(--shadow-md)', minWidth: '120px', display: 'flex', flexDirection: 'column',
                            padding: '4px'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {!item.isDirectory && (
                            <button className="dropdown-item" onClick={() => { handleDownload(item.path); setOpenDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                              <Download size={14} /> Download
                            </button>
                          )}
                          <button className="dropdown-item" onClick={() => { handleCopy(item); setOpenDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                            <Copy size={14} /> Copy
                          </button>
                          <button className="dropdown-item" onClick={() => { handleRename(item.path, item.name); setOpenDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                            <Edit2 size={14} /> Rename
                          </button>
                          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                          <button className="dropdown-item" onClick={(e) => { handleDelete(item.path, e); setOpenDropdown(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--accent-danger)', textAlign: 'left', width: '100%', borderRadius: '4px' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddServer && (
        <ServerConnectionModal 
          editData={editConnectionData}
          onClose={() => { setShowAddServer(false); setEditConnectionData(null); }} 
          onSuccess={() => {
            setShowAddServer(false);
            setEditConnectionData(null);
            qc.invalidateQueries(['remote_connections']);
          }}
        />
      )}
    </div>
  );
}
