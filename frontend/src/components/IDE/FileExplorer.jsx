import React, { useState, useRef } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, Folder, File, RefreshCw, Plus, FilePlus, FolderPlus, Trash2, Edit2 } from 'lucide-react';
import { useIdeStore, detectLanguage } from '../../store/ideStore.js';
import api from '../../api/client.js';
import { toast, useUIStore } from '../../store/uiStore.js';

// File type → icon color mapping (VS Code Seti icon theme approximation)
const FILE_COLORS = {
  js: '#f0db4f', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  py: '#4b8bbe',  html: '#e44d26', css: '#264de4', scss: '#c76494',
  json: '#f0db4f', md: '#519aba',  yml: '#cb171e', yaml: '#cb171e',
  go: '#00add8',  rs: '#dea584',   java: '#b07219', rb: '#cc342d',
  sh: '#89e051',  bash: '#89e051', xml: '#e37933', sql: '#e38d00',
  c: '#283593',   cpp: '#00599c',  cs: '#178600',  php: '#8892bf',
  vue: '#42b883', svelte: '#ff3e00', dart: '#00b4ab',
};

function getFileColor(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return FILE_COLORS[ext] || '#cccccc';
}

function getFileEmoji(name, isDir) {
  if (isDir) return null;
  const ext = name?.split('.').pop()?.toLowerCase();
  // Return specific letters for file type badges
  return null;
}

function TreeNode({ item, depth = 0, selectedPath, onSelect, onContextMenu }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const openFile = useIdeStore((s) => s.openFile);

  const toggle = async (e) => {
    e.stopPropagation();
    onSelect(item);

    if (!item.isDirectory) {
      // Load file content
      try {
        const res = await api.get('/fs/read', { params: { file: item.path } });
        openFile({ ...item, content: res.data.content, language: detectLanguage(item.name) });
      } catch { toast.error('Cannot read file'); }
      return;
    }

    if (!expanded && !loaded) {
      setLoading(true);
      try {
        const res = await api.get('/fs/list', { params: { dir: item.path } });
        setChildren(res.data.items || []);
        setLoaded(true);
      } catch { toast.error('Cannot list directory'); }
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  const refresh = async () => {
    try {
      const res = await api.get('/fs/list', { params: { dir: item.path } });
      setChildren(res.data.items || []);
    } catch {}
  };

  const indentPx = depth * 12 + 8;

  return (
    <>
      <div
        className={`vsc-tree-item ${selectedPath === item.path ? 'selected' : ''}`}
        style={{ paddingLeft: indentPx }}
        onClick={toggle}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
        title={item.path}
      >
        {/* Arrow for directories */}
        <div className="vsc-tree-item-icon" style={{ width: 14, marginRight: 2 }}>
          {item.isDirectory ? (
            loading ? (
              <div style={{ width: 10, height: 10, border: '1.5px solid #666', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
        </div>

        {/* Folder/File icon */}
        <div className="vsc-tree-item-icon" style={{ color: item.isDirectory ? '#dcb67a' : getFileColor(item.name) }}>
          {item.isDirectory
            ? expanded ? <FolderOpen size={14} /> : <Folder size={14} />
            : <File size={13} />
          }
        </div>

        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}>
          {item.name}
        </span>
      </div>

      {/* Children */}
      {item.isDirectory && expanded && loaded && (
        children.length === 0 ? (
          <div style={{ paddingLeft: indentPx + 26, height: 22, display: 'flex', alignItems: 'center', color: '#555', fontSize: '12px' }}>
            (empty)
          </div>
        ) : (
          children.map((child) => (
            <TreeNode
              key={child.path}
              item={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))
        )
      )}
    </>
  );
}

export default function VSExplorer({ rootItems, rootPath, onRefresh }) {
  const [selectedPath, setSelectedPath] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }
  const openFile = useIdeStore((s) => s.openFile);
  const setRootPath = useIdeStore((s) => s.setRootPath);
  const lastOpenedPath = useUIStore((s) => s.lastOpenedPath);
  const setLastOpenedPath = useUIStore((s) => s.setLastOpenedPath);

  const handleContextMenu = (e, item) => {
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContext = () => setContextMenu(null);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.post('/fs/delete', { targetPath: item.path });
      onRefresh();
    } catch { toast.error('Delete failed'); }
    closeContext();
  };

  const openInEditor = async (item) => {
    if (item.isDirectory) return;
    try {
      const res = await api.get('/fs/read', { params: { file: item.path } });
      openFile({ ...item, content: res.data.content, language: detectLanguage(item.name) });
    } catch { toast.error('Cannot open file'); }
    closeContext();
  };

  const handleNewFile = async (item) => {
    const name = prompt('New file name:');
    if (!name) return;
    const targetDir = item.isDirectory ? item.path : item.path.split(/[/\\]/).slice(0, -1).join('/');
    const targetPath = `${targetDir}/${name}`;
    try {
      await api.post('/fs/write', { file: targetPath, content: '' });
      onRefresh();
    } catch { toast.error('Create failed'); }
    closeContext();
  };

  const handleNewFolder = async (item) => {
    const name = prompt('New folder name:');
    if (!name) return;
    const targetDir = item.isDirectory ? item.path : item.path.split(/[/\\]/).slice(0, -1).join('/');
    const targetPath = `${targetDir}/${name}`;
    try {
      await api.post('/fs/mkdir', { targetPath });
      onRefresh();
    } catch { toast.error('Create folder failed'); }
    closeContext();
  };

  const handleReveal = async (item) => {
    try {
      await api.post('/fs/reveal', { targetPath: item.path });
    } catch { toast.error('Reveal failed'); }
    closeContext();
  };

  const handleOpenTerminal = (item) => {
    const targetDir = item.isDirectory ? item.path : item.path.split(/[/\\]/).slice(0, -1).join('/');
    if (!useIdeStore.getState().showPanel) useIdeStore.getState().togglePanel();
    document.dispatchEvent(new CustomEvent('vsc:new-terminal', { detail: { cwd: targetDir } }));
    closeContext();
  };

  const handleFindInFolder = (item) => {
    const targetDir = item.isDirectory ? item.path : item.path.split(/[/\\]/).slice(0, -1).join('/');
    useIdeStore.getState().setSearchQuery(targetDir);
    useIdeStore.getState().setSidebarView('search');
    if (!useIdeStore.getState().showSidebar) useIdeStore.getState().toggleSidebar();
    closeContext();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={() => contextMenu && closeContext()}>

      {/* Workspace label */}
      <div className="vsc-sidebar-title">
        <span>EXPLORER</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="vsc-panel-btn" onClick={onRefresh} title="Refresh Explorer" style={{ width: 22, height: 22 }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Open Folder */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 6 }}
          onClick={async () => {
            try {
              const res = await api.get('/fs/pick-folder', { params: { defaultPath: lastOpenedPath || '' } });
              if (res.data.path) {
                setLastOpenedPath(res.data.path);
                setRootPath(res.data.path);
                onRefresh(res.data.path);
              }
            } catch (e) {}
          }}
        >
          <FolderOpen size={14} /> Open Folder
        </button>
      </div>

      {/* Workspace name */}
      {rootPath && (
        <div style={{
          padding: '6px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: '#cccccc', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
        }}
          onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, { path: rootPath, isDirectory: true, name: rootPath.split(/[/\\]/).pop() || rootPath }); }}
        >
          <ChevronDown size={12} />
          {rootPath.split(/[/\\]/).pop() || rootPath}
        </div>
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {!rootPath || rootItems.length === 0 ? (
          <div style={{ padding: '20px 12px', color: '#555', fontSize: '12px', textAlign: 'center', lineHeight: 1.8 }}>
            No folder open.<br />
            Enter a path above or click Open Folder.
            <div style={{ marginTop: 12 }}>
              <button
                style={{ background: '#0e639c', color: 'white', border: 'none', padding: '5px 12px', cursor: 'pointer', fontSize: '12px', borderRadius: 2 }}
                onClick={async () => { 
                  try {
                    const res = await api.get('/fs/pick-folder', { params: { defaultPath: lastOpenedPath || '' } });
                    if (res.data.path) {
                      setLastOpenedPath(res.data.path);
                      setRootPath(res.data.path);
                      onRefresh(res.data.path);
                    }
                  } catch (e) {}
                }}
              >
                Open Folder
              </button>
            </div>
          </div>
        ) : (
          rootItems.map((item) => (
            <TreeNode
              key={item.path}
              item={item}
              depth={0}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Outline section */}
      <div style={{ borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ padding: '6px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#bbbbbb', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <ChevronRight size={12} /> OUTLINE
        </div>
      </div>
      <div style={{ borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ padding: '6px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#bbbbbb', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <ChevronRight size={12} /> TIMELINE
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="vsc-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.item.isDirectory && (
            <div className="vsc-dropdown-item" onClick={() => openInEditor(contextMenu.item)}>Open</div>
          )}
          <div className="vsc-dropdown-item" onClick={() => handleNewFile(contextMenu.item)}>New File...</div>
          <div className="vsc-dropdown-item" onClick={() => handleNewFolder(contextMenu.item)}>New Folder...</div>
          <div className="vsc-dropdown-divider" />
          <div className="vsc-dropdown-item" onClick={() => handleReveal(contextMenu.item)}>Reveal in File Explorer</div>
          <div className="vsc-dropdown-item" onClick={() => handleOpenTerminal(contextMenu.item)}>Open in Integrated Terminal</div>
          <div className="vsc-dropdown-divider" />
          <div className="vsc-dropdown-item" onClick={() => handleFindInFolder(contextMenu.item)}>Find in Folder...</div>
          <div className="vsc-dropdown-divider" />
          <div className="vsc-dropdown-item" onClick={() => { navigator.clipboard.writeText(contextMenu.item.path); closeContext(); }}>
            Copy Path
          </div>
          <div className="vsc-dropdown-item" onClick={() => { 
            const relPath = contextMenu.item.path.replace(rootPath, '').replace(/^[\\/]/, '');
            navigator.clipboard.writeText(relPath); 
            closeContext(); 
          }}>
            Copy Relative Path
          </div>
          <div className="vsc-dropdown-divider" />
          <div className="vsc-dropdown-item" style={{ color: '#f14c4c' }} onClick={() => handleDelete(contextMenu.item)}>
            <Trash2 size={12} /> Delete
          </div>
          {contextMenu.item.path === rootPath && (
            <>
              <div className="vsc-dropdown-divider" />
              <div className="vsc-dropdown-item" onClick={() => { setRootPath(''); onRefresh(''); closeContext(); }}>
                Remove Folder from Workspace
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
