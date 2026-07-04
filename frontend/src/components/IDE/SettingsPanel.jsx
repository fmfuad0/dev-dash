import React from 'react';
import { useIdeStore } from '../../store/ideStore';
import { Settings2 } from 'lucide-react';

export default function SettingsPanel() {
  const theme = useIdeStore((s) => s.theme);
  const setTheme = useIdeStore((s) => s.setTheme);
  const fontSize = useIdeStore((s) => s.fontSize);
  const setFontSize = useIdeStore((s) => s.setFontSize);
  const wordWrap = useIdeStore((s) => s.wordWrap);
  const toggleWordWrap = useIdeStore((s) => s.toggleWordWrap);
  const ideMode = useIdeStore((s) => s.ideMode);
  const setIdeMode = useIdeStore((s) => s.setIdeMode);

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="vsc-sidebar-title">SETTINGS</div>
      
      <div style={{ padding: '16px', color: '#cccccc', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings2 size={14} /> IDE Mode
          </label>
          <select 
            value={ideMode}
            onChange={(e) => setIdeMode(e.target.value)}
            style={{ 
              background: '#3c3c3c', color: '#cccccc', border: '1px solid #3c3c3c', 
              padding: '4px 8px', borderRadius: '2px', outline: 'none'
            }}
          >
            <option value="vscode">Core VS Code Engine</option>
            <option value="dev-dash">DEV-DASH IDE</option>
          </select>
          <div style={{ fontSize: '11px', color: '#858585' }}>
            Core VS Code runs locally via code-server. DEV-DASH IDE uses Monaco.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings2 size={14} /> Theme
          </label>
          <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{ 
              background: '#3c3c3c', color: '#cccccc', border: '1px solid #3c3c3c', 
              padding: '4px 8px', borderRadius: '2px', outline: 'none'
            }}
          >
            <option value="vs-dark">Dark (VS Code)</option>
            <option value="vs-light">Light (VS Code)</option>
            <option value="hc-black">High Contrast Dark</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontWeight: 600, color: '#e0e0e0' }}>Font Size</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="range" 
              min="10" 
              max="28" 
              value={fontSize} 
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ width: '30px', textAlign: 'right', fontFamily: 'monospace' }}>{fontSize}px</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontWeight: 600, color: '#e0e0e0' }}>Editor: Word Wrap</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={wordWrap === 'on'} 
              onChange={toggleWordWrap}
              style={{ cursor: 'pointer' }}
            />
            Enable Word Wrap
          </label>
        </div>

      </div>
    </div>
  );
}
