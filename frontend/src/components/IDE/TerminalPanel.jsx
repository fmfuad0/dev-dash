import React, { useRef, useEffect, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useSocketStore } from '../../store/socketStore';
import { useIdeStore } from '../../store/ideStore';
import 'xterm/css/xterm.css';

export default function TerminalPanel({ mode = 'panel' }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termIdRef = useRef(null);
  const socket = useSocketStore((s) => s.socket);
  const setPanelTermId = useIdeStore((s) => s.setPanelTermId);

  useEffect(() => {
    if (!terminalRef.current || !socket) return;

    const xterm = new XTerm({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b70',
        black: '#45475a', red: '#f38ba8', green: '#a6e3a1',
        yellow: '#f9e2af', blue: '#89b4fa', magenta: '#cba6f7',
        cyan: '#89dceb', white: '#bac2de',
        brightBlack: '#585b70', brightRed: '#f38ba8',
        brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
        brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
        brightCyan: '#89dceb', brightWhite: '#a6adc8',
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    setTimeout(() => fitAddon.fit(), 50);
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    socket.emit('client:terminal.spawn', { cols: xterm.cols, rows: xterm.rows }, (res) => {
      if (res?.id) {
        termIdRef.current = res.id;
        if (setPanelTermId) setPanelTermId(res.id);
      }
    });

    const onData = xterm.onData((data) => {
      if (termIdRef.current) socket.emit('client:terminal.data', { id: termIdRef.current, data });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (termIdRef.current) {
          socket.emit('client:terminal.resize', { id: termIdRef.current, cols: xterm.cols, rows: xterm.rows });
        }
      } catch {}
    });
    if (terminalRef.current) resizeObserver.observe(terminalRef.current);

    const onServerData = ({ id, data }) => {
      if (id === termIdRef.current) xterm.write(data);
    };
    socket.on('server:terminal.data', onServerData);

    return () => {
      resizeObserver.disconnect();
      onData.dispose();
      socket.off('server:terminal.data', onServerData);
      if (termIdRef.current) socket.emit('client:terminal.kill', { id: termIdRef.current });
      xterm.dispose();
    };
  }, [socket]);

  return (
    <div style={{ height: '100%', width: '100%', background: '#1e1e2e', padding: '4px 4px 0 4px' }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
