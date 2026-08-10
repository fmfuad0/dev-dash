import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore.js';
import { useSocketStore } from '../store/socketStore.js';

/**
 * Initialises Socket.IO connection and binds server events to
 * TanStack Query cache invalidation.
 */
export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const socket = useSocketStore((s) => s.socket);
  const setSocket = useSocketStore((s) => s.setSocket);
  const connected = useSocketStore((s) => s.connected);
  const setConnected = useSocketStore((s) => s.setConnected);
  const daemonOnline = useSocketStore((s) => s.daemonOnline);
  const setDaemonOnline = useSocketStore((s) => s.setDaemonOnline);
  const reset = useSocketStore((s) => s.reset);

  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      reset();
      return;
    }

    const backendUrl = import.meta.env.DEV ? 'http://localhost:5000' : '/';
    const s = io(backendUrl, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => { setConnected(false); setDaemonOnline(false); });

    // ── Artifact events → invalidate queries ───────────────────────────────────
    s.on('server:artifact.created', ({ workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
      queryClient.invalidateQueries({ queryKey: ['artifact-stats'] });
    });
    s.on('server:artifact.updated', ({ artifactId, workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['artifact', artifactId] });
      queryClient.invalidateQueries({ queryKey: ['artifacts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['artifact-stats'] });
    });
    s.on('server:artifact.deleted', ({ artifactId, workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['artifact', artifactId] });
      queryClient.invalidateQueries({ queryKey: ['artifacts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['artifact-stats'] });
    });

    // ── Daemon heartbeat ack ───────────────────────────────────────────────────
    s.on('server:daemon.ack', () => setDaemonOnline(true));

    return () => {
      s.disconnect();
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { socket, connected, daemonOnline };
}
