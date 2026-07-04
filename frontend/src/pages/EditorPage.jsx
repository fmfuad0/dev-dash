import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import {
  Files, Search as SearchIcon, GitBranch, Package, Settings,
  X, Plus, Minus, Square, ChevronRight, ChevronDown,
  GitCommit, GitPullRequest, AlertCircle, Info, CheckCircle,
  RotateCcw, Maximize2, Split, MoreHorizontal, AlignLeft,
  Play, Save, Download, RefreshCw, Folder, Bell, Shield,
  Code2, Terminal as TermIcon,
} from 'lucide-react';
import { useIdeStore, detectLanguage } from '../store/ideStore.js';
import { useSocketStore } from '../store/socketStore.js';
import FileExplorer from '../components/IDE/FileExplorer.jsx';
import MultiTerminal from '../components/IDE/MultiTerminal.jsx';
import SettingsPanel from '../components/IDE/SettingsPanel.jsx';
import SourceControlPanel from '../components/IDE/SourceControlPanel.jsx';
import ExtensionsPanel from '../components/IDE/ExtensionsPanel.jsx';
import api from '../api/client.js';
import { toast } from '../store/uiStore.js';
import '../styles/vscode.css';

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
function Breadcrumb({ path }) {
  if (!path) return null;
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return (
    <div className="vsc-breadcrumb">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="vsc-breadcrumb-sep">›</span>}
          <span className={`vsc-breadcrumb-item ${i === parts.length - 1 ? 'last' : ''}`}>
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Title Bar Menu Definition ────────────────────────────────────────────────
function buildMenus({ onNewFile, onSave, onSaveAll, onDownload, onSaveArtifact,
  onUndo, onRedo, onFind, onReplace, onFindInFiles,
  onToggleSidebar, onTogglePanel, onToggleWordWrap, onZoomIn, onZoomOut,
  onRunFile, onClearTerminal, onGitMacro, onFormatDoc, onSelectAll, triggerMonaco
}) {
  return {
    File: [
      { label: 'New File',          action: onNewFile,        shortcut: 'Ctrl+N' },
      { divider: true },
      { label: 'Open Folder…',      action: () => { const p = prompt('Enter folder path:'); if (p) useIdeStore.getState().setRootPath(p); } },
      { divider: true },
      { label: 'Save',              action: onSave,           shortcut: 'Ctrl+S' },
      { label: 'Save All',          action: onSaveAll,        shortcut: 'Ctrl+K S' },
      { label: 'Save as Artifact',  action: onSaveArtifact },
      { label: 'Download',          action: onDownload },
      { divider: true },
      { label: 'Close Editor',      action: () => { const { activeTabPath, closeTab } = useIdeStore.getState(); if (activeTabPath) closeTab(activeTabPath); }, shortcut: 'Ctrl+W' },
    ],
    Edit: [
      { label: 'Undo',              action: onUndo,           shortcut: 'Ctrl+Z' },
      { label: 'Redo',              action: onRedo,           shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: 'Cut',               action: () => document.execCommand('cut'),   shortcut: 'Ctrl+X' },
      { label: 'Copy',              action: () => document.execCommand('copy'),  shortcut: 'Ctrl+C' },
      { label: 'Paste',             action: () => document.execCommand('paste'), shortcut: 'Ctrl+V' },
      { divider: true },
      { label: 'Find',              action: onFind,           shortcut: 'Ctrl+F' },
      { label: 'Replace',           action: onReplace,        shortcut: 'Ctrl+H' },
      { label: 'Find in Files',     action: onFindInFiles,    shortcut: 'Ctrl+Shift+F' },
      { divider: true },
      { label: 'Format Document',   action: onFormatDoc,      shortcut: 'Shift+Alt+F' },
      { label: 'Select All',        action: onSelectAll,      shortcut: 'Ctrl+A' },
    ],
    Selection: [
      { label: 'Select All',        action: onSelectAll,      shortcut: 'Ctrl+A' },
      { label: 'Expand Selection',  action: () => triggerMonaco?.('editor.action.smartSelect.expand'),         shortcut: 'Shift+Alt+→' },
      { label: 'Shrink Selection',  action: () => triggerMonaco?.('editor.action.smartSelect.shrink'),         shortcut: 'Shift+Alt+←' },
      { divider: true },
      { label: 'Add Cursor Above',  action: () => triggerMonaco?.('editor.action.insertCursorAbove'),         shortcut: 'Ctrl+Alt+↑' },
      { label: 'Add Cursor Below',  action: () => triggerMonaco?.('editor.action.insertCursorBelow'),         shortcut: 'Ctrl+Alt+↓' },
    ],
    View: [
      { label: 'Explorer',              action: () => { useIdeStore.getState().setSidebarView('explorer'); if (!useIdeStore.getState().showSidebar) useIdeStore.getState().toggleSidebar(); } },
      { label: 'Search',                action: () => { useIdeStore.getState().setSidebarView('search'); if (!useIdeStore.getState().showSidebar) useIdeStore.getState().toggleSidebar(); } },
      { label: 'Source Control',        action: () => { useIdeStore.getState().setSidebarView('git'); if (!useIdeStore.getState().showSidebar) useIdeStore.getState().toggleSidebar(); } },
      { divider: true },
      { label: 'Toggle Panel',          action: onTogglePanel,     shortcut: 'Ctrl+`' },
      { label: 'Toggle Sidebar',        action: onToggleSidebar,   shortcut: 'Ctrl+B' },
      { label: 'Toggle Word Wrap',      action: onToggleWordWrap,  shortcut: 'Alt+Z' },
      { divider: true },
      { label: 'Zoom In',               action: onZoomIn,          shortcut: 'Ctrl+=' },
      { label: 'Zoom Out',              action: onZoomOut,         shortcut: 'Ctrl+-' },
    ],
    Go: [
      { label: 'Go to File…',       action: () => { useIdeStore.getState().setSidebarView('search'); if (!useIdeStore.getState().showSidebar) useIdeStore.getState().toggleSidebar(); }, shortcut: 'Ctrl+P' },
      { label: 'Go to Line…',       action: () => triggerMonaco?.('editor.action.gotoLine'), shortcut: 'Ctrl+G' },
      { label: 'Go to Symbol…',     action: () => triggerMonaco?.('editor.action.gotoSymbol'), shortcut: 'Ctrl+Shift+O' },
      { divider: true },
      { label: 'Back',              action: () => triggerMonaco?.('workbench.action.navigateBack'), shortcut: 'Alt+←' },
      { label: 'Forward',           action: () => triggerMonaco?.('workbench.action.navigateForward'), shortcut: 'Alt+→' },
    ],
    Terminal: [
      { label: 'New Terminal',      action: () => { if (!useIdeStore.getState().showPanel) useIdeStore.getState().togglePanel(); document.dispatchEvent(new CustomEvent('vsc:new-terminal')); } },
      { divider: true },
      { label: 'Run Active File',   action: onRunFile },
      { label: 'Clear Terminal',    action: onClearTerminal },
      { divider: true },
      { label: 'Git: Status',       action: () => onGitMacro('git status\r') },
      { label: 'Git: Add All',      action: () => onGitMacro('git add .\r') },
      { label: 'Git: Commit',       action: () => { const m = prompt('Commit message:'); if (m) onGitMacro(`git commit -m "${m}"\r`); } },
      { label: 'Git: Push',         action: () => onGitMacro('git push\r') },
      { label: 'Git: Pull',         action: () => onGitMacro('git pull\r') },
    ],
    Help: [
      { label: 'Welcome',           action: () => {} },
      { label: 'Documentation',     action: () => window.open('https://code.visualstudio.com/docs', '_blank') },
      { divider: true },
      { label: 'Keyboard Shortcuts', action: () => triggerMonaco?.('editor.action.showContextMenu'), shortcut: 'Ctrl+K Ctrl+S' },
    ],
  };
}

// ─── Title Bar ────────────────────────────────────────────────────────────────
function TitleBar({ activeFile, menus }) {
  const [openMenu, setOpenMenu] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const exec = (action) => { action?.(); setOpenMenu(null); };

  return (
    <div className="vsc-titlebar" ref={ref}>
      {/* App icon */}
      <div style={{ width: 48, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Code2 size={16} color="#007acc" />
      </div>

      {/* Menus */}
      <div className="vsc-titlebar-menu">
        {Object.entries(menus).map(([key, items]) => (
          <div key={key} style={{ position: 'relative' }}>
            <div
              className={`vsc-titlebar-menu-item ${openMenu === key ? 'open' : ''}`}
              onClick={() => setOpenMenu(openMenu === key ? null : key)}
              onMouseEnter={() => openMenu && setOpenMenu(key)}
            >
              {key}
            </div>
            {openMenu === key && (
              <div className="vsc-dropdown">
                {items.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="vsc-dropdown-divider" />
                  ) : (
                    <div
                      key={i}
                      className={`vsc-dropdown-item ${item.disabled ? 'disabled' : ''}`}
                      onClick={() => !item.disabled && exec(item.action)}
                    >
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Title */}
      <div className="vsc-titlebar-title">
        {activeFile ? `${activeFile.name} — DEV DASH IDE` : 'DEV DASH IDE'}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', height: '100%', flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={() => useIdeStore.getState().setIdeMode('vscode')}
          style={{
            background: '#0e639c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 2,
            fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            marginRight: 16
          }}
          title="Switch to Core VS Code Engine"
        >
          <Code2 size={12} /> VS Code Core
        </button>
      </div>

      {/* Window controls (decorative) */}
      <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
        <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          className="vsc-titlebar-menu-item">
          <Minus size={12} />
        </div>
        <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          className="vsc-titlebar-menu-item">
          <Square size={10} />
        </div>
        <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent' }}
          className="vsc-titlebar-menu-item"
          onMouseEnter={(e) => e.currentTarget.style.background = '#c42b1c'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <X size={12} />
        </div>
      </div>
    </div>
  );
}

// ─── Activity Bar ─────────────────────────────────────────────────────────────
function ActivityBar({ activeView, onViewChange, showSidebar }) {
  const TOP_ICONS = [
    { id: 'explorer',   Icon: Files,      title: 'Explorer (Ctrl+Shift+E)' },
    { id: 'search',     Icon: SearchIcon, title: 'Search (Ctrl+Shift+F)' },
    { id: 'git',        Icon: GitBranch,  title: 'Source Control (Ctrl+Shift+G)' },
    { id: 'extensions', Icon: Package,    title: 'Extensions (Ctrl+Shift+X)' },
  ];

  return (
    <div className="vsc-activitybar">
      {TOP_ICONS.map(({ id, Icon, title }) => (
        <div
          key={id}
          className={`vsc-activitybar-icon ${activeView === id && showSidebar ? 'active' : ''}`}
          title={title}
          onClick={() => onViewChange(id)}
        >
          <Icon size={24} />
        </div>
      ))}
      <div className="vsc-activitybar-bottom">
        <div 
          className={`vsc-activitybar-icon ${activeView === 'settings' && showSidebar ? 'active' : ''}`}
          title="Settings"
          onClick={() => onViewChange('settings')}
        >
          <Settings size={22} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, activeTabPath, onSelect, onClose }) {
  const FILE_LANG_COLORS = {
    javascript: '#f0db4f', typescript: '#3178c6', python: '#4b8bbe',
    html: '#e44d26', css: '#264de4', json: '#f0db4f', markdown: '#519aba',
  };

  return (
    <div className="vsc-tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={`vsc-tab ${tab.path === activeTabPath ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
          onClick={() => onSelect(tab.path)}
          title={tab.path}
        >
          {/* Lang color dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: FILE_LANG_COLORS[tab.language] || '#858585',
            display: 'inline-block',
          }} />
          <span className="vsc-tab-name">{tab.name}</span>
          <button
            className="vsc-tab-close"
            onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}
            title="Close"
          >
            {tab.isDirty ? '●' : '×'}
          </button>
        </div>
      ))}
      {/* New tab */}
      <div
        title="New File"
        style={{ width: 35, height: 35, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#858585', flexShrink: 0 }}
        onClick={() => useIdeStore.getState().openFile({ path: `untitled-${Date.now()}`, name: 'Untitled', content: '', language: 'plaintext', isDirty: true })}
        onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Plus size={14} />
      </div>
    </div>
  );
}

// ─── Problems Panel ───────────────────────────────────────────────────────────
function ProblemsPanel() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1e1e1e' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px', color: '#555', fontSize: '13px', gap: 8 }}>
        <CheckCircle size={16} color='#3fb950' />
        No problems have been detected in the workspace.
      </div>
    </div>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────
function OutputPanel() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1e1e1e', padding: '4px 12px', fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#cccccc' }}>
      <div style={{ color: '#555' }}>[DEV DASH IDE] Output console ready.</div>
    </div>
  );
}


// ─── Search Sidebar ───────────────────────────────────────────────────────────
function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const rootPath = useIdeStore((s) => s.rootPath);
  const openFile = useIdeStore((s) => s.openFile);

  const doSearch = async () => {
    if (!query.trim() || !rootPath) return;
    setSearching(true);
    try {
      const res = await api.get('/fs/search', { params: { root: rootPath, query } });
      setResults(res.data.results || []);
    } catch {
      toast.error('Search not available');
    }
    setSearching(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="vsc-sidebar-title">SEARCH</div>
      <div style={{ padding: '8px', flexShrink: 0 }}>
        <input
          className="vsc-search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          style={{ marginBottom: 4 }}
        />
        <button
          onClick={doSearch}
          disabled={searching}
          style={{ width: '100%', background: '#0e639c', color: 'white', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '12px', borderRadius: 2, marginTop: 4 }}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {results.length === 0 && !searching && (
          <div style={{ padding: '12px', color: '#555', fontSize: '12px' }}>
            {query ? 'No results' : 'Type to search across files'}
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid #1e1e1e' }}>
            <div style={{ padding: '4px 8px', fontSize: '12px', color: '#cccccc', fontWeight: 600 }}>{r.file}</div>
            {r.matches?.map((m, j) => (
              <div
                key={j}
                style={{ padding: '2px 16px', fontSize: '12px', color: '#858585', cursor: 'pointer', fontFamily: 'Consolas, monospace' }}
                onClick={() => openFile({ path: r.path, name: r.file, content: r.content, language: detectLanguage(r.file) })}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: '#555' }}>{m.line}: </span>
                {m.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Main EditorPage ──────────────────────────────────────────────────────────
const PANEL_MIN = 100;
const PANEL_DEF = 200;
const SIDEBAR_DEF = 250;
const SIDEBAR_MIN = 120;

export default function EditorPage() {
  const editorRef       = useRef(null);
  const panelDragRef    = useRef(null);
  const sidebarDragRef  = useRef(null);
  const socket          = useSocketStore((s) => s.socket);

  // IDE Store
  const openTabs        = useIdeStore((s) => s.openTabs);
  const activeTabPath   = useIdeStore((s) => s.activeTabPath);
  const updateTabContent= useIdeStore((s) => s.updateTabContent);
  const markTabSaved    = useIdeStore((s) => s.markTabSaved);
  const closeTab        = useIdeStore((s) => s.closeTab);
  const setActiveTab    = useIdeStore((s) => s.setActiveTab);
  const openFile        = useIdeStore((s) => s.openFile);
  const showSidebar     = useIdeStore((s) => s.showSidebar);
  const showPanel       = useIdeStore((s) => s.showPanel);
  const wordWrap        = useIdeStore((s) => s.wordWrap);
  const activeSidebarView = useIdeStore((s) => s.activeSidebarView);
  const panelTermId     = useIdeStore((s) => s.panelTermId);
  const rootPath        = useIdeStore((s) => s.rootPath);
  const setRootPath     = useIdeStore((s) => s.setRootPath);
  const toggleSidebar   = useIdeStore((s) => s.toggleSidebar);
  const togglePanel     = useIdeStore((s) => s.togglePanel);
  const toggleWordWrap  = useIdeStore((s) => s.toggleWordWrap);
  const setSidebarView  = useIdeStore((s) => s.setSidebarView);
  const theme           = useIdeStore((s) => s.theme);
  const fontSize        = useIdeStore((s) => s.fontSize);
  const setFontSize     = useIdeStore((s) => s.setFontSize);
  const ideMode         = useIdeStore((s) => s.ideMode);
  const setIdeMode      = useIdeStore((s) => s.setIdeMode);

  const [panelHeight,  setPanelHeight]  = useState(PANEL_DEF);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEF);
  const [panelTab,     setPanelTab]     = useState('TERMINAL');
  const [rootItems,    setRootItems]    = useState([]);
  const [cursorPos,    setCursorPos]    = useState({ line: 1, col: 1 });
  const [eol,          setEol]          = useState('LF');
  const [engineReady,  setEngineReady]  = useState(false);
  const engineBootedRef = useRef(false);

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Load root directory
  const loadRoot = useCallback(async (path) => {
    const p = path !== undefined ? path : rootPath;
    if (!p) {
      setRootItems([]);
      setRootPath('');
      return;
    }
    try {
      const res = await api.get('/fs/list', { params: { dir: p } });
      setRootItems(res.data.items || []);
      setRootPath(res.data.path);
    } catch {}
  }, [rootPath, setRootPath]);

  useEffect(() => { loadRoot(); }, [rootPath]);

  // ── Engine Boot ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ideMode === 'vscode') {
      if (socket && !engineBootedRef.current) {
        engineBootedRef.current = true;
        
        // Create a completely hidden, headless terminal purely for running this command
        // This leverages the integrated terminal backend (node-pty) to completely bypass Windows popups
        socket.emit('client:terminal.spawn', { cwd: rootPath || 'C:/', cols: 80, rows: 24 }, (res) => {
          if (res?.id) {
            const tempTermId = res.id;
            
            // Run code-server in the FOREGROUND of this hidden terminal (no '&')
            // This prevents WSL from automatically shutting down and killing the process.
            const cmd = `wsl -d Ubuntu -e bash -c "if ! ps aux | grep -v grep | grep -q code-server; then code-server --bind-addr 127.0.0.1:8080 --auth none > /dev/null 2>&1; fi"\r`;
            
            socket.emit('client:terminal.data', { id: tempTermId, data: cmd });
            
            // Give it 2 seconds to bind to port, but NEVER kill this terminal!
            // It holds the WSL instance open silently in the background.
            setTimeout(() => {
              setEngineReady(true);
            }, 2000);
          } else {
            // fallback if terminal creation failed
            setEngineReady(true);
          }
        });
      }
    } else {
      setEngineReady(false);
      engineBootedRef.current = false;
    }
  }, [ideMode, socket, rootPath]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 's')      { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === 'b')      { e.preventDefault(); toggleSidebar(); }
      if (e.ctrlKey && e.key === '`')      { e.preventDefault(); togglePanel(); }
      if (e.ctrlKey && e.key === 'w')      { e.preventDefault(); if (activeTabPath) closeTab(activeTabPath); }
      if (e.ctrlKey && e.key === 'n')      { e.preventDefault(); handleNewFile(); }
      if (e.altKey  && e.key === 'z')      { e.preventDefault(); toggleWordWrap(); }
      if (e.ctrlKey && e.key === '=')      { e.preventDefault(); setFontSize((f) => Math.min(f + 1, 28)); }
      if (e.ctrlKey && e.key === '-')      { e.preventDefault(); setFontSize((f) => Math.max(f - 1, 8)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabPath, toggleSidebar, togglePanel, toggleWordWrap, closeTab]);

  // ── Panel resize drag ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = panelDragRef.current;
    if (!el) return;
    let startY, startH;
    const onDown = (e) => { startY = e.clientY; startH = panelHeight; el.classList.add('dragging'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };
    const onMove = (e) => setPanelHeight(Math.max(PANEL_MIN, startH + (startY - e.clientY)));
    const onUp   = ()  => { el.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [panelHeight]);

  // ── Sidebar resize drag ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = sidebarDragRef.current;
    if (!el) return;
    let startX, startW;
    const onDown = (e) => { startX = e.clientX; startW = sidebarWidth; el.classList.add('dragging'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };
    const onMove = (e) => setSidebarWidth(Math.max(SIDEBAR_MIN, startW + (e.clientX - startX)));
    const onUp   = ()  => { el.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [sidebarWidth]);

  // ── File actions ────────────────────────────────────────────────────────────
  const handleNewFile = () => openFile({ path: `untitled-${Date.now()}`, name: 'Untitled', content: '', language: 'plaintext' });

  const handleSave = useCallback(async () => {
    if (!activeTab || activeTab.path.startsWith('untitled-')) {
      toast.info('Use File > Save As to save new files to disk'); return;
    }
    try {
      await api.post('/fs/write', { file: activeTab.path, content: activeTab.content });
      markTabSaved(activeTab.path);
      toast.success(`Saved: ${activeTab.name}`);
    } catch { toast.error('Save failed'); }
  }, [activeTab, markTabSaved]);

  const handleSaveAll = useCallback(async () => {
    for (const tab of openTabs.filter((t) => t.isDirty && !t.path.startsWith('untitled-'))) {
      try { await api.post('/fs/write', { file: tab.path, content: tab.content }); markTabSaved(tab.path); } catch {}
    }
    toast.success('All files saved');
  }, [openTabs, markTabSaved]);

  const handleSaveArtifact = async () => {
    if (!activeTab) return;
    try {
      await api.post('/artifacts', { title: activeTab.name, contentText: activeTab.content, kind: 'snippet', language: activeTab.language });
      toast.success('Saved as Artifact');
    } catch { toast.error('Failed'); }
  };

  const handleDownload = () => {
    if (!activeTab) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([activeTab.content], { type: 'text/plain' }));
    a.download = activeTab.name;
    a.click();
  };

  // ── Monaco actions ──────────────────────────────────────────────────────────
  const triggerMonaco = (action) => editorRef.current?.trigger('keyboard', action, null);
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  // ── Terminal actions ────────────────────────────────────────────────────────
  const handleRunFile = useCallback(() => {
    if (!activeTab || !panelTermId || !socket) { toast.error('Open a file and wait for terminal'); return; }
    const cmd = activeTab.language === 'python' ? `python "${activeTab.path}"\r`
              : activeTab.language === 'javascript' || activeTab.language === 'typescript' ? `node "${activeTab.path}"\r`
              : activeTab.language === 'shell' ? `bash "${activeTab.path}"\r` : null;
    if (!cmd) { toast.error('No runner for this file type'); return; }
    handleSave().then(() => { if (!showPanel) togglePanel(); socket.emit('client:terminal.data', { id: panelTermId, data: cmd }); });
  }, [activeTab, panelTermId, socket, showPanel, togglePanel, handleSave]);

  const handleClearTerminal = () => {
    if (panelTermId && socket) socket.emit('client:terminal.data', { id: panelTermId, data: '\x0c' });
  };

  const handleGitMacro = (cmd) => {
    if (!panelTermId || !socket) { toast.error('Terminal not ready'); return; }
    if (!showPanel) togglePanel();
    socket.emit('client:terminal.data', { id: panelTermId, data: cmd });
  };

  // ── Build menu object ───────────────────────────────────────────────────────
  const menus = buildMenus({
    onNewFile: handleNewFile, onSave: handleSave, onSaveAll: handleSaveAll,
    onDownload: handleDownload, onSaveArtifact: handleSaveArtifact,
    onUndo: () => triggerMonaco('undo'), onRedo: () => triggerMonaco('redo'),
    onFind: () => triggerMonaco('actions.find'),
    onReplace: () => triggerMonaco('editor.action.startFindReplaceAction'),
    onFindInFiles: () => { setSidebarView('search'); if (!showSidebar) toggleSidebar(); },
    onToggleSidebar: toggleSidebar, onTogglePanel: togglePanel, onToggleWordWrap: toggleWordWrap,
    onZoomIn: () => setFontSize((f) => Math.min(f + 1, 28)),
    onZoomOut: () => setFontSize((f) => Math.max(f - 1, 8)),
    onRunFile: handleRunFile, onClearTerminal: handleClearTerminal, onGitMacro: handleGitMacro,
    onFormatDoc: () => triggerMonaco('editor.action.formatDocument'),
    onSelectAll: () => triggerMonaco('editor.action.selectAll'),
    triggerMonaco,
  });

  const PANEL_TABS = ['TERMINAL', 'OUTPUT', 'PROBLEMS', 'DEBUG CONSOLE', 'PORTS'];

  const handleActivityClick = (view) => {
    if (activeSidebarView === view && showSidebar) { toggleSidebar(); }
    else { setSidebarView(view); if (!showSidebar) toggleSidebar(); }
  };

  if (ideMode === 'vscode') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
        {engineReady ? (
          <iframe 
            src="http://127.0.0.1:8080" 
            style={{ width: '100%', height: '100%', border: 'none' }} 
            title="VS Code Core Engine"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
            <Code2 size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
            <div style={{ fontFamily: '"Segoe UI", sans-serif', fontSize: '14px' }}>Starting VS Code Core Engine...</div>
          </div>
        )}
        <button
          onClick={() => setIdeMode('dev-dash')}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            padding: '8px 12px',
            background: '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
          }}
          title="Switch back to DEV-DASH IDE"
        >
          <Code2 size={14} />
          Switch to DEV-DASH
        </button>
      </div>
    );
  }

  return (
    <div className="vsc-root">
      {/* ── Title Bar ── */}
      <TitleBar activeFile={activeTab} menus={menus} />

      {/* ── Workbench ── */}
      <div className="vsc-workbench">

        {/* ── Activity Bar ── */}
        <ActivityBar
          activeView={activeSidebarView}
          onViewChange={handleActivityClick}
          showSidebar={showSidebar}
        />

        {/* ── Sidebar ── */}
        {showSidebar && (
          <>
            <div className="vsc-sidebar" style={{ width: sidebarWidth }}>
              {activeSidebarView === 'explorer' && (
                <FileExplorer rootItems={rootItems} rootPath={rootPath} onRefresh={loadRoot} />
              )}
              {activeSidebarView === 'search' && <SearchPanel />}
              {activeSidebarView === 'git'    && <SourceControlPanel socket={socket} panelTermId={panelTermId} />}
              {activeSidebarView === 'extensions' && <ExtensionsPanel />}
              {activeSidebarView === 'settings' && <SettingsPanel />}
            </div>
            {/* Sidebar resize handle */}
            <div ref={sidebarDragRef} className="vsc-sidebar-resize" />
          </>
        )}

        {/* ── Editor + Panel area ── */}
        <div className="vsc-editor-area">
            {/* ── Tab Bar ── */}
            {openTabs.length > 0 && (
                <TabBar
                  tabs={openTabs}
                  activeTabPath={activeTabPath}
                  onSelect={setActiveTab}
                  onClose={closeTab}
                />
              )}

              {/* ── Breadcrumb ── */}
              {activeTab && <Breadcrumb path={activeTab.path} />}

              {/* ── Monaco Editor (full VS Code features enabled) ── */}
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
                {activeTab ? (
                  <Editor
                    key={activeTab.path}
                    height="100%"
                    language={activeTab.language}
                    theme={theme}
                    value={activeTab.content}
                    path={activeTab.path}
                    onChange={(v) => updateTabContent(activeTab.path, v || '')}
                    onMount={handleEditorMount}
                    options={{
                      fontSize,
                      fontFamily: '"Cascadia Code", "JetBrains Mono", "Consolas", monospace',
                      fontLigatures: true,
                      wordWrap,
                      lineNumbers: 'on',
                      minimap: { enabled: true, autohide: true },
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'all',
                      bracketPairColorization: { enabled: true },
                      guides: { bracketPairs: true, indentation: true },
                      suggest: { showIcons: true, shareSuggestSelections: true, preview: true },
                      quickSuggestions: { other: true, comments: true, strings: true },
                      parameterHints: { enabled: true },
                      formatOnPaste: true,
                      formatOnType: true,
                      tabSize: 2,
                      insertSpaces: true,
                      detectIndentation: true,
                      autoIndent: 'full',
                      autoClosingBrackets: 'always',
                      autoClosingQuotes: 'always',
                      automaticLayout: true,
                      scrollbar: { verticalScrollbarSize: 10 },
                      padding: { top: 8 },
                      renderWhitespace: 'selection',
                      smoothScrolling: true,
                      cursorBlinking: 'blink',
                      cursorSmoothCaretAnimation: 'on',
                      multiCursorModifier: 'ctrlCmd',
                      linkedEditing: true,
                      codeLens: true,
                      folding: true,
                      foldingHighlight: true,
                      showFoldingControls: 'mouseover',
                      colorDecorators: true,
                      lightbulb: { enabled: 'on' },
                      inlayHints: { enabled: 'on' },
                      glyphMargin: true,
                      stickyScroll: { enabled: true },
                      accessibilitySupport: 'off',
                    }}
                  />
                ) : (
                  <div className="vsc-editor-empty">
                    <Code2 size={64} style={{ marginBottom: 24, opacity: 0.15 }} />
                    <h2>DEV DASH IDE</h2>
                    <div className="vsc-editor-empty-shortcuts">
                      <span className="action">Open Folder</span>      <span className="key">Use Explorer sidebar</span>
                      <span className="action">New File</span>          <span className="key">Ctrl+N</span>
                      <span className="action">Open File</span>         <span className="key">Click in tree</span>
                      <span className="action">Find in Files</span>     <span className="key">Ctrl+Shift+F</span>
                      <span className="action">Toggle Terminal</span>   <span className="key">Ctrl+`</span>
                      <span className="action">Toggle Sidebar</span>    <span className="key">Ctrl+B</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Panel Resize Handle ── */}
              <div ref={panelDragRef} className="vsc-panel-resize" style={{ display: showPanel ? 'block' : 'none' }} />

              {/* ── Bottom Panel ── */}
              <div className="vsc-panel" style={{ height: panelHeight, display: showPanel ? 'flex' : 'none' }}>
                {/* Panel Tab Bar */}
                <div className="vsc-panel-tabs">
                  {PANEL_TABS.map((t) => (
                    <div
                      key={t}
                      className={`vsc-panel-tab ${panelTab === t ? 'active' : ''}`}
                      onClick={() => setPanelTab(t)}
                    >
                      {t}
                    </div>
                  ))}
                  <div className="vsc-panel-actions">
                    <button className="vsc-panel-btn" title="Clear" onClick={handleClearTerminal}><RotateCcw size={13} /></button>
                    <button className="vsc-panel-btn" title="Split" ><Split size={13} /></button>
                    <button className="vsc-panel-btn" title="Maximize" onClick={() => setPanelHeight((h) => h > 400 ? PANEL_DEF : 500)}><Maximize2 size={13} /></button>
                    <button className="vsc-panel-btn" title="Close Panel" onClick={togglePanel}><X size={13} /></button>
                  </div>
                </div>

                {/* Panel Content */}
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ height: '100%', width: '100%', display: panelTab === 'TERMINAL' ? 'block' : 'none' }}>
                    <MultiTerminal />
                  </div>
                  {panelTab === 'OUTPUT'         && <OutputPanel />}
                  {panelTab === 'PROBLEMS'       && <ProblemsPanel />}
                  {panelTab === 'DEBUG CONSOLE'  && <OutputPanel />}
                  {panelTab === 'PORTS'          && <div style={{ padding: 12, color: '#555', fontSize: '12px' }}>No forwarded ports.</div>}
                </div>
              </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="vsc-statusbar">
        {/* Left */}
        <div className="vsc-statusbar-item" title="Source Control" onClick={() => handleActivityClick('git')}>
          <GitBranch size={13} /> main
        </div>
        <div className="vsc-statusbar-item" title="Errors & Warnings">
          <AlertCircle size={13} /> 0
          <Info size={13} style={{ marginLeft: 6 }} /> 0
        </div>

        {/* Right */}
        <div className="vsc-statusbar-right">
          {activeTab && (
            <>
              <div className="vsc-statusbar-item" title="Go to Line/Column">
                Ln {cursorPos.line}, Col {cursorPos.col}
              </div>
              <div className="vsc-statusbar-item" title="Select Indentation">
                Spaces: 2
              </div>
              <div className="vsc-statusbar-item" title="Select Encoding">
                UTF-8
              </div>
              <div className="vsc-statusbar-item" title="Select End of Line Sequence">
                {eol}
              </div>
              <div className="vsc-statusbar-item" title="Select Language Mode" onClick={() => {}}>
                {activeTab.language || 'Plain Text'}
              </div>
            </>
          )}
          <div className="vsc-statusbar-item" title="Run File" onClick={handleRunFile} style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Play size={12} /> Run
          </div>
          <div className="vsc-statusbar-item" title="Save" onClick={handleSave} style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Save size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
