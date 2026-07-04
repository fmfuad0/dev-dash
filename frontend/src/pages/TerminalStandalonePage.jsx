import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useSocketStore } from '../store/socketStore.js';
import { Plus, X, ChevronDown, Code2, Terminal as TermIcon, Maximize2, RotateCcw } from 'lucide-react';
import 'xterm/css/xterm.css';
import '../styles/vscode.css';

const SHELLS = [
  { id: 'powershell', label: 'PowerShell',    badge: 'PS', cmd: 'powershell.exe', color: '#2671be' },
  { id: 'cmd',        label: 'Command Prompt', badge: 'C>', cmd: 'cmd.exe',        color: '#cccccc' },
  { id: 'gitbash',   label: 'Git Bash',       badge: '$',  cmd: 'bash.exe',       color: '#89e051' },
  { id: 'wsl',       label: 'WSL Bash',       badge: 'λ',  cmd: 'wsl.exe',        color: '#ff6600' },
];

const VSC_THEME = {
  background:       '#1e1e1e',
  foreground:       '#cccccc',
  cursor:           '#aeafad',
  cursorAccent:     '#1e1e1e',
  selectionBackground: '#264f78',
  black:   '#1e1e1e', red:     '#f44747', green:  '#608b4e', yellow: '#dcdcaa',
  blue:    '#569cd6', magenta: '#c678dd', cyan:   '#56b6c2', white:  '#d4d4d4',
  brightBlack:   '#808080', brightRed:     '#f44747', brightGreen:  '#6a9955',
  brightYellow:  '#dcdcaa', brightBlue:    '#569cd6', brightMagenta:'#c678dd',
  brightCyan:    '#4ec9b0', brightWhite:   '#d4d4d4',
};

const TermInstance = forwardRef(function TermInstance({ session, isActive, socket, onReady, onExit }, ref) {
  const containerRef = useRef(null);
  const xtermRef     = useRef(null);
  const fitRef       = useRef(null);
  const termIdRef    = useRef(null);
  const initialized  = useRef(false);

  useImperativeHandle(ref, () => ({
    clear: () => xtermRef.current?.clear(),
    focus: () => xtermRef.current?.focus(),
    fit:   () => { try { fitRef.current?.fit(); } catch {} },
    write: (data) => { if (termIdRef.current && socket) socket.emit('client:terminal.data', { id: termIdRef.current, data }); },
    termId: () => termIdRef.current,
  }));

  const doFit = useCallback(() => {
    const fit = () => { try { fitRef.current?.fit(); } catch {} };
    fit(); setTimeout(fit, 50); setTimeout(fit, 200); setTimeout(fit, 500);
  }, []);

  useEffect(() => {
    if (!socket || initialized.current || !containerRef.current) return;
    initialized.current = true;

    const xterm = new XTerm({
      theme: VSC_THEME,
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowTransparency: false,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    try { xterm.loadAddon(new WebLinksAddon()); } catch {}

    xterm.open(containerRef.current);
    xterm.write('\r\n\x1b[32m>>> XTERM.JS INITIALIZED AND RENDERED <<<\x1b[0m\r\n');
    xtermRef.current = xterm;
    fitRef.current   = fitAddon;
    doFit();

    const requestId = `req-${Date.now()}-${Math.random()}`;

    const handleSpawned = ({ id, requestId: rid }) => {
      if (rid && rid !== requestId) return;
      if (id && !termIdRef.current) { termIdRef.current = id; if (onReady) onReady(session.id, id); }
    };
    socket.on('server:terminal.spawned', handleSpawned);

    socket.emit('client:terminal.spawn', {
      shell: session.shell.cmd,
      cols: xterm.cols,
      rows: xterm.rows,
      requestId,
    }, (res) => {
      if (res?.id && !termIdRef.current) {
        termIdRef.current = res.id;
        if (onReady) onReady(session.id, res.id);
        socket.off('server:terminal.spawned', handleSpawned);
      }
      if (res?.error) xterm.write(`\r\n\x1b[31mShell error: ${res.error}\x1b[0m\r\n`);
    });

    const onData  = xterm.onData((d) => { if (termIdRef.current) socket.emit('client:terminal.data', { id: termIdRef.current, data: d }); });
    const onSrvData = ({ id, data }) => { if (id === termIdRef.current) xterm.write(data); };
    const onSrvExit = ({ id })      => { if (id === termIdRef.current) { xterm.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n'); if (onExit) onExit(session.id); } };

    socket.on('server:terminal.data', onSrvData);
    socket.on('server:terminal.exit', onSrvExit);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
      try {
        fitAddon.fit();
        if (termIdRef.current) socket.emit('client:terminal.resize', { id: termIdRef.current, cols: xterm.cols, rows: xterm.rows });
      } catch {}
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect(); onData.dispose();
      socket.off('server:terminal.data', onSrvData);
      socket.off('server:terminal.exit', onSrvExit);
      socket.off('server:terminal.spawned', handleSpawned);
      if (termIdRef.current) socket.emit('client:terminal.kill', { id: termIdRef.current });
      xterm.dispose();
      initialized.current = false;
    };
  }, [socket]);

  useEffect(() => {
    if (isActive) { doFit(); setTimeout(() => xtermRef.current?.focus(), 80); }
  }, [isActive, doFit]);

  return (
    <div ref={containerRef}
      style={{ position: 'absolute', inset: 0, display: isActive ? 'block' : 'none', background: '#1e1e1e', padding: '4px 4px 4px 8px' }}
    />
  );
});

export default function TerminalStandalonePage() {
  const socket = useSocketStore((s) => s.socket);

  const [sessions,    setSessions]    = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const [initialized, setInitialized] = useState(false);
  const counterRef   = useRef({});
  const sessionRefs  = useRef({});

  // Init first session once socket available
  useEffect(() => {
    if (!socket || initialized) return;
    setInitialized(true);
    const id = Date.now();
    counterRef.current.powershell = 1;
    setSessions([{ id, shell: SHELLS[0], label: 'PowerShell 1' }]);
    setActiveId(id);
  }, [socket, initialized]);

  const addSession = (shell) => {
    counterRef.current[shell.id] = (counterRef.current[shell.id] || 0) + 1;
    const n = counterRef.current[shell.id];
    const id = Date.now();
    setSessions((p) => [...p, { id, shell, label: `${shell.label} ${n}` }]);
    setActiveId(id);
    setShowPicker(false);
  };

  const removeSession = (e, id) => {
    e.stopPropagation();
    delete sessionRefs.current[id];
    setSessions((p) => {
      const next = p.filter((s) => s.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const activeSession = sessions.find((s) => s.id === activeId);
  const activeRef     = sessionRefs.current[activeId];

  return (
    <div className="vsc-root" style={{ height: '100%' }}>
      {/* ── Title Bar ── */}
      <div style={{
        height: 35, background: '#252526', display: 'flex', alignItems: 'center',
        padding: '0 8px', gap: 8, borderBottom: '1px solid #1e1e1e', flexShrink: 0,
      }}>
        <TermIcon size={14} color="#007acc" />

        {/* Session tabs */}
        <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden', height: '100%', alignItems: 'flex-end' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 10px', height: 29, cursor: 'pointer', fontSize: '12px',
                background: s.id === activeId ? '#1e1e1e' : 'transparent',
                color: s.id === activeId ? '#cccccc' : '#858585',
                borderTop: s.id === activeId ? '1px solid #007acc' : '1px solid transparent',
                borderLeft: '1px solid transparent', borderRight: '1px solid transparent',
                borderBottom: 'none', borderRadius: '3px 3px 0 0',
                userSelect: 'none', flexShrink: 0,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (s.id !== activeId) e.currentTarget.style.background = '#2a2d2e'; }}
              onMouseLeave={(e) => { if (s.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: s.shell.color, fontFamily: 'monospace', fontSize: '10px', fontWeight: 700 }}>
                {s.shell.badge}
              </span>
              <span>{s.label}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => removeSession(e, s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 2, display: 'flex', borderRadius: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#cccccc')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* New terminal button with picker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            style={{
              background: 'none', border: '1px solid #404040', cursor: 'pointer',
              color: '#cccccc', display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 3, fontSize: '12px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <Plus size={11} /> New <ChevronDown size={10} />
          </button>

          {showPicker && (
            <>
              {/* Backdrop */}
              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowPicker(false)} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#252526', border: '1px solid #454545',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                zIndex: 9999, minWidth: 200, borderRadius: 4, padding: '4px 0',
              }}>
                {SHELLS.map((sh) => (
                  <div
                    key={sh.id}
                    onClick={() => addSession(sh)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 14px', cursor: 'pointer', fontSize: '12px', color: '#cccccc',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#094771'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: sh.color, fontFamily: 'monospace', fontWeight: 700, width: 18 }}>{sh.badge}</span>
                    {sh.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button title="Clear" onClick={() => activeRef?.clear()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#858585', padding: 4, display: 'flex', borderRadius: 3 }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#3e3e3e'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
            <RotateCcw size={13} />
          </button>
          <button title="Maximize"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#858585', padding: 4, display: 'flex', borderRadius: 3 }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#3e3e3e'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Terminal Area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {!socket ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#555', gap: 12 }}>
            <div style={{ width: 24, height: 24, border: '2px solid #333', borderTopColor: '#007acc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Connecting to server…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#555', flexDirection: 'column', gap: 12 }}>
            <TermIcon size={40} />
            <div style={{ fontSize: '13px' }}>No terminal open</div>
            <button
              onClick={() => addSession(SHELLS[0])}
              style={{ background: '#0e639c', color: 'white', border: 'none', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', borderRadius: 3 }}
            >
              New Terminal
            </button>
          </div>
        ) : (
          sessions.map((s) => (
            <TermInstance
              key={s.id}
              ref={(r) => { if (r) sessionRefs.current[s.id] = r; else delete sessionRefs.current[s.id]; }}
              session={s}
              isActive={s.id === activeId}
              socket={socket}
              onReady={(sid, tid) => {}} // standalone doesn't need panelTermId
            />
          ))
        )}
      </div>

      {/* ── Status Bar ── */}
      <div className="vsc-statusbar" style={{ fontSize: '11px' }}>
        <div className="vsc-statusbar-item">
          <TermIcon size={11} /> Terminal
        </div>
        {activeSession && (
          <div className="vsc-statusbar-item">
            <span style={{ color: activeSession.shell.color }}>{activeSession.shell.badge}</span>
            {activeSession.shell.label}
          </div>
        )}
        <div className="vsc-statusbar-right">
          <div className="vsc-statusbar-item">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
