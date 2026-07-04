import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useSocketStore } from '../../store/socketStore';
import 'xterm/css/xterm.css';

export default function TerminalWindow({ cwd, onTerminalReady }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termIdRef = useRef(null);
  const socket = useSocketStore((s) => s.socket);

  useEffect(() => {
    if (!terminalRef.current || !socket) return;

    const xterm = new XTerm({
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: 'monospace',
      fontSize: 13,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Spawn terminal
    socket.emit('client:terminal.spawn', { cwd, cols: xterm.cols, rows: xterm.rows }, (res) => {
      if (res.id) {
        termIdRef.current = res.id;
        if (onTerminalReady) onTerminalReady(res.id);
      }
    });

    // Write from xterm to socket
    const onDataDisposable = xterm.onData((data) => {
      if (termIdRef.current) {
        socket.emit('client:terminal.data', { id: termIdRef.current, data });
      }
    });

    // Resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (termIdRef.current) {
        socket.emit('client:terminal.resize', { 
          id: termIdRef.current, 
          cols: xterm.cols, 
          rows: xterm.rows 
        });
      }
    });
    resizeObserver.observe(terminalRef.current);

    // Read from socket to xterm
    const onServerData = (payload) => {
      if (payload.id === termIdRef.current) {
        xterm.write(payload.data);
      }
    };
    socket.on('server:terminal.data', onServerData);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      socket.off('server:terminal.data', onServerData);
      
      if (termIdRef.current) {
        socket.emit('client:terminal.kill', { id: termIdRef.current });
      }
      xterm.dispose();
    };
  }, [socket, cwd]);

  return (
    <div style={{ height: '100%', width: '100%', background: '#1e1e1e', padding: 8 }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
