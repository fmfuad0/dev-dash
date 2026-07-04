import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function MenuBar({ 
  onNewFile, onSave, onSaveAsArtifact, onDownload, 
  onUndo, onRedo, onCut, onCopy, onPaste, onFind, onReplace, 
  toggleSidebar, toggleTerminal, toggleWordWrap, 
  onRunActiveFile, onClearTerminal,
  onGitMacro
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const executeAction = (action) => {
    action();
    setActiveMenu(null);
  };

  const MENUS = {
    file: [
      { label: 'New File', action: onNewFile },
      { label: 'Save', action: onSave, shortcut: 'Ctrl+S' },
      { label: 'Save as Artifact...', action: onSaveAsArtifact },
      { divider: true },
      { label: 'Download', action: onDownload }
    ],
    edit: [
      { label: 'Undo', action: onUndo, shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: onRedo, shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: 'Cut', action: onCut, shortcut: 'Ctrl+X' },
      { label: 'Copy', action: onCopy, shortcut: 'Ctrl+C' },
      { label: 'Paste', action: onPaste, shortcut: 'Ctrl+V' },
      { divider: true },
      { label: 'Find', action: onFind, shortcut: 'Ctrl+F' },
      { label: 'Replace', action: onReplace, shortcut: 'Ctrl+H' },
    ],
    view: [
      { label: 'Toggle Sidebar', action: toggleSidebar },
      { label: 'Toggle Terminal', action: toggleTerminal, shortcut: 'Ctrl+`' },
      { divider: true },
      { label: 'Toggle Word Wrap', action: toggleWordWrap },
    ],
    terminal: [
      { label: 'Run Active File', action: onRunActiveFile },
      { label: 'Clear Terminal', action: onClearTerminal },
    ],
    git: [
      { label: 'Git Status', action: () => onGitMacro('git status\\r') },
      { label: 'Git Add All', action: () => onGitMacro('git add .\\r') },
      { label: 'Git Commit (m)', action: () => onGitMacro('git commit -m "Update"\\r') },
      { label: 'Git Push', action: () => onGitMacro('git push\\r') },
      { label: 'Git Pull', action: () => onGitMacro('git pull\\r') },
    ]
  };

  return (
    <div ref={menuRef} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      background: 'var(--bg-base)', 
      borderBottom: '1px solid var(--border-default)',
      padding: '0 8px',
      fontSize: '0.85rem',
      userSelect: 'none'
    }}>
      {Object.entries(MENUS).map(([key, items]) => (
        <div key={key} style={{ position: 'relative' }}>
          <div 
            onClick={() => handleMenuClick(key)}
            onMouseEnter={() => activeMenu && setActiveMenu(key)}
            style={{ 
              padding: '6px 12px', 
              cursor: 'pointer',
              textTransform: 'capitalize',
              color: activeMenu === key ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: activeMenu === key ? 'var(--bg-elevated)' : 'transparent',
              borderRadius: '4px 4px 0 0'
            }}
            className="hover-bg-subtle"
          >
            {key}
          </div>

          {activeMenu === key && (
            <div style={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0, 
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0 4px 4px 4px',
              minWidth: 200,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 100,
              padding: '4px 0'
            }}>
              {items.map((item, idx) => item.divider ? (
                <div key={idx} style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              ) : (
                <div 
                  key={idx}
                  onClick={() => executeAction(item.action)}
                  style={{ 
                    padding: '6px 16px', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'var(--text-primary)'
                  }}
                  className="hover-bg-subtle"
                >
                  <span>{item.label}</span>
                  {item.shortcut && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.shortcut}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
