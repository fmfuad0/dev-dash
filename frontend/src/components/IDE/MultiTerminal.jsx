import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useSocketStore } from '../../store/socketStore.js';
import { useIdeStore } from '../../store/ideStore.js';
import { Plus, X, Trash2, ChevronDown, RotateCcw } from 'lucide-react';
import 'xterm/css/xterm.css';

const SHELLS = [
  { id: 'powershell', label: 'PowerShell', icon: '⚡', cmd: 'powershell.exe',    color: '#2671be', badge: 'PS' },
  { id: 'cmd',       label: 'Command Prompt', icon: '>', cmd: 'cmd.exe',           color: '#4af626', badge: 'C:\\' },
  { id: 'gitbash',   label: 'Git Bash',     icon: 'B', cmd: 'C:\\Program Files\\Git\\bin\\bash.exe', color: '#f34f29', badge: '~' },
  { id: 'docker',    label: 'Docker Engine',icon: '🐳',cmd: 'docker',            color: '#0db7ed', badge: '🐳' },
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

// Single xterm instance component
const TermInstance = forwardRef(function TermInstance({ session, isActive, socket, onReady, onExit }, ref) {
  const containerRef = useRef(null);
  const xtermRef     = useRef(null);
  const fitRef       = useRef(null);
  const termIdRef    = useRef(null);
  const initialized  = useRef(false);
  const dataHandlerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    fit: () => { try { fitRef.current?.fit(); } catch {} },
    write: (data) => { if (termIdRef.current && socket) socket.emit('client:terminal.data', { id: termIdRef.current, data }); },
    clear: () => { xtermRef.current?.clear(); },
    focus: () => { xtermRef.current?.focus(); },
    termId: () => termIdRef.current,
  }));

  // Fit with retries
  const doFit = useCallback(() => {
    const fit = () => { try { fitRef.current?.fit(); } catch {} };
    fit();
    setTimeout(fit, 50);
    setTimeout(fit, 150);
    setTimeout(fit, 300);
  }, []);

  useEffect(() => {
    if (!socket || initialized.current) return;

    // Wait for container to be in DOM and visible
    const initTerminal = () => {
      if (!containerRef.current) return;
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
        disableStdin: false,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);

      try {
        const webLinks = new WebLinksAddon();
        xterm.loadAddon(webLinks);
      } catch {}

      // Open terminal in container
      xterm.open(containerRef.current);
      xterm.write('\r\n\x1b[32m>>> XTERM.JS INITIALIZED AND RENDERED <<<\x1b[0m\r\n');
      xtermRef.current = xterm;
      fitRef.current   = fitAddon;

      // Fit after open
      doFit();

      // Generate a unique request ID to match spawned event
      const requestId = `req-${Date.now()}-${Math.random()}`;

      // Handle spawn response via BOTH callback AND event (belt+suspenders)
      const handleSpawned = ({ id, requestId: rid, error }) => {
        if (rid && rid !== requestId) return; // not our session
        if (error) { xterm.write(`\r\n\x1b[31mError spawning terminal: ${error}\x1b[0m\r\n`); return; }
        if (id && !termIdRef.current) {
          termIdRef.current = id;
          if (onReady) onReady(session.id, id);
        }
      };

      socket.on('server:terminal.spawned', handleSpawned);

      // Spawn the shell process on the backend
      socket.emit('client:terminal.spawn', {
        shell: session.shell.cmd,
        cwd: session.cwd,
        cols: xterm.cols,
        rows: xterm.rows,
        requestId,
      }, (res) => {
        if (res?.id && !termIdRef.current) {
          termIdRef.current = res.id;
          if (onReady) onReady(session.id, res.id);
          socket.off('server:terminal.spawned', handleSpawned);
        } else if (res?.error) {
          xterm.write(`\r\n\x1b[31mError: ${res.error}\x1b[0m\r\n`);
        }
      });

      // Send user input to backend
      const onData = xterm.onData((data) => {
        if (termIdRef.current) {
          socket.emit('client:terminal.data', { id: termIdRef.current, data });
        }
      });

      // Receive output from backend
      const serverDataHandler = ({ id, data }) => {
        if (id === termIdRef.current) {
          xterm.write(data);
        }
      };
      socket.on('server:terminal.data', serverDataHandler);
      dataHandlerRef.current = serverDataHandler;

      // Handle terminal exit
      const exitHandler = ({ id }) => {
        if (id === termIdRef.current) {
          xterm.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
          if (onExit) onExit(session.id);
        }
      };
      socket.on('server:terminal.exit', exitHandler);

      // Resize observer — refit whenever container size changes
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
        try {
          fitAddon.fit();
          if (termIdRef.current) {
            socket.emit('client:terminal.resize', {
              id: termIdRef.current,
              cols: xterm.cols,
              rows: xterm.rows,
            });
          }
        } catch {}
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        onData.dispose();
        socket.off('server:terminal.data', serverDataHandler);
        socket.off('server:terminal.exit', exitHandler);
        socket.off('server:terminal.spawned', handleSpawned);
        if (termIdRef.current) socket.emit('client:terminal.kill', { id: termIdRef.current });
        xterm.dispose();
        initialized.current = false;
      };
    };

    // Small delay to ensure the DOM container has dimensions
    const cleanup = initTerminal();
    return () => { if (cleanup) cleanup(); };
  }, [socket]);

  // When tab becomes active, refit and focus
  useEffect(() => {
    if (isActive) {
      doFit();
      setTimeout(() => xtermRef.current?.focus(), 100);
    }
  }, [isActive, doFit]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        background: '#1e1e1e',
        padding: '4px 4px 4px 8px',
      }}
    >
      <div
        ref={containerRef}
        style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}
      />
    </div>
  );
});

export default function MultiTerminal({ onReady: onReadyProp }) {
  const socket       = useSocketStore((s) => s.socket);
  const setPanelTermId = useIdeStore((s) => s.setPanelTermId);

  const [sessions,     setSessions]     = useState([]);
  const [activeId,     setActiveId]     = useState(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [initialized,  setInitialized]  = useState(false);
  const sessionRefs    = useRef({});
  const counterRef     = useRef({});

  // Initialize first session once socket is ready
  useEffect(() => {
    if (!socket || initialized) return;
    setInitialized(true);
    const first = { id: Date.now(), shell: SHELLS[0], label: 'PowerShell 1' };
    setSessions([first]);
    setActiveId(first.id);
  }, [socket, initialized]);

  const handleReady = useCallback((sessionId, termId) => {
    // First terminal's termId becomes the panel default for running files
    setSessions((prev) => {
      const isFirst = prev.findIndex((s) => s.id === sessionId) === 0;
      if (isFirst) {
        setPanelTermId(termId);
        if (onReadyProp) onReadyProp(termId);
      }
      return prev; // no state change needed, just side effects
    });
  }, [setPanelTermId, onReadyProp]);

  const addSession = useCallback((shell, cwd) => {
    counterRef.current[shell.id] = (counterRef.current[shell.id] || 0) + 1;
    const n = counterRef.current[shell.id];
    const id = Date.now();
    const label = `${shell.label} ${n}`;
    setSessions((prev) => [...prev, { id, shell, label, cwd }]);
    setActiveId(id);
    setShowPicker(false);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const cwd = e.detail?.cwd;
      addSession(SHELLS[0], cwd);
    };
    document.addEventListener('vsc:new-terminal', handler);
    return () => document.removeEventListener('vsc:new-terminal', handler);
  }, [addSession]);

  const removeSession = (e, id) => {
    e.stopPropagation();
    delete sessionRefs.current[id];
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id && next.length > 0) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* ── Session list (right sidebar, VS Code style) ── */}
      <div className="vsc-terminal-sessions">
        <div style={{
          padding: '6px 8px 2px', fontSize: '10px', fontWeight: 700,
          color: '#858585', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          TERMINAL
        </div>

        {sessions.map((s) => (
          <div
            key={s.id}
            className={`vsc-terminal-session-item ${activeId === s.id ? 'active' : ''}`}
            onClick={() => setActiveId(s.id)}
          >
            <span style={{
              fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
              color: s.shell.color, flexShrink: 0, width: 16,
            }}>
              {s.shell.badge}
            </span>
            <span className="vsc-terminal-session-name">{s.label}</span>
            <button
              onClick={(e) => removeSession(e, s.id)}
              title="Kill terminal"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#666', padding: '1px 2px', display: 'flex',
                borderRadius: 2, opacity: 0,
              }}
              className="session-kill-btn"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {/* New terminal button */}
        <div style={{ position: 'relative', marginTop: 4 }}>
          <div
            className="vsc-terminal-session-item"
            onClick={() => setShowPicker(!showPicker)}
            style={{ color: '#858585' }}
          >
            <Plus size={12} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px' }}>New Terminal</span>
            <ChevronDown size={10} style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </div>

          {showPicker && (
            <div style={{
              position: 'absolute', top: '100%', left: 4, right: 4,
              background: '#252526', border: '1px solid #454545',
              boxShadow: '0 4px 16px rgba(0,0,0,0.7)', zIndex: 9999, borderRadius: 4,
            }}>
              {SHELLS.map((sh) => (
                <div
                  key={sh.id}
                  onClick={() => addSession(sh)}
                  style={{
                    padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                    color: '#cccccc', display: 'flex', alignItems: 'center', gap: 8,
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#094771'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: sh.color, fontFamily: 'monospace', fontWeight: 700, minWidth: 16 }}>{sh.badge}</span>
                  {sh.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kill session */}
        {activeId && (
          <div
            className="vsc-terminal-session-item"
            onClick={(e) => sessions.length > 0 && removeSession(e, activeId)}
            style={{ color: '#858585', marginTop: 4, borderTop: '1px solid #2d2d2d', paddingTop: 8 }}
          >
            <Trash2 size={12} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px' }}>Kill Terminal</span>
          </div>
        )}
      </div>

      {/* ── Terminal panes ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        {!socket ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#1e1e1e', color: '#555', fontSize: '13px', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ width: 20, height: 20, border: '2px solid #444', borderTopColor: '#007acc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Connecting…
          </div>
        ) : (
          sessions.map((s) => (
            <TermInstance
              key={s.id}
              ref={(r) => { if (r) sessionRefs.current[s.id] = r; else delete sessionRefs.current[s.id]; }}
              session={s}
              isActive={s.id === activeId}
              socket={socket}
              onReady={handleReady}
            />
          ))
        )}
      </div>

      <style>{`
        .session-kill-btn { opacity: 0 !important; }
        .vsc-terminal-session-item:hover .session-kill-btn { opacity: 1 !important; }
        .vsc-terminal-session-item.active .session-kill-btn { opacity: 0.5 !important; }
        .vsc-terminal-session-item.active:hover .session-kill-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
