'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const os = require('os');
const pty = require('node-pty');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO gateway with JWT auth and room management
 */
function initSocketGateway(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    destroyUpgrade: false, // CRITICAL: Prevent Socket.io from killing VS Code WebSockets!
  });

  // ─── Auth Middleware ────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Missing auth token'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('Invalid auth token'));
    }
  });

  // ─── Active Terminals ───────────────────────────────────────────────────────
  // Store terminals globally per user so they persist across socket disconnects
  const activeTerminals = {}; // userId -> { termId: { process, buffer, metadata, ... } }

  // ─── Connection Handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Join user-scoped room for targeted events
    socket.join(`user:${userId}`);

    // ── Client Events ─────────────────────────────────────────────────────────

    // Daemon heartbeat
    socket.on('client:daemon.heartbeat', (data) => {
      logger.debug({ userId, data }, 'Daemon heartbeat');
      socket.emit('server:daemon.ack', { ts: Date.now() });
    });

    // Join workspace room for collaborative events
    socket.on('client:workspace.join', (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
      logger.debug({ userId, workspaceId }, 'Joined workspace room');
    });

    socket.on('client:workspace.leave', (workspaceId) => {
      socket.leave(`workspace:${workspaceId}`);
    });

    // Canvas CRDT update relay
    socket.on('client:canvas.update', (data) => {
      const { canvasId, update } = data;
      // Broadcast to all other clients in workspace
      socket.to(`workspace:${data.workspaceId}`).emit('server:canvas.update', {
        canvasId,
        update,
        fromSocket: socket.id,
      });
    });

    // Vault unlock intent (daemon picks this up)
    socket.on('client:vault.unlock.intent', (data) => {
      logger.info({ userId, vaultItemId: data.vaultItemId }, 'Vault unlock intent');
      socket.emit('server:vault.unlock.pending', { vaultItemId: data.vaultItemId });
    });

    // ── Integrated Terminal ───────────────────────────────────────────────────
    if (!activeTerminals[userId]) activeTerminals[userId] = {};
    const terminals = activeTerminals[userId];

    socket.on('client:terminal.list', (payload, callback) => {
      const list = Object.keys(terminals).map(id => ({
        id,
        metadata: terminals[id].metadata
      }));
      if (typeof callback === 'function') callback(list);
    });

    socket.on('client:terminal.attach', (payload, callback) => {
      const term = terminals[payload.id];
      if (term) {
        logger.info({ id: payload.id, bufferLength: term.buffer.length }, 'Attaching to terminal');
        if (typeof callback === 'function') callback({ history: term.buffer });
      } else {
        logger.warn({ id: payload.id }, 'Attach failed: Terminal not found');
        if (typeof callback === 'function') callback({ error: 'Terminal not found' });
      }
    });

    socket.on('client:terminal.spawn', (data, callback) => {
      try {
        const platform = os.platform();
        const defaultShell = platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
        const shell = data.shell || defaultShell;
        const cwd = data.cwd || os.homedir();
        const cols = data.cols || 120;
        const rows = data.rows || 30;

        logger.info({ shell, cwd, cols, rows }, 'Spawning terminal');

        const ptyArgs = [];
        if (shell === 'docker') {
          // If the user requests the Docker terminal, exec into the vscode engine container
          ptyArgs.push('exec', '-it', 'vscode-engine', '/bin/bash');
        } else if (platform === 'win32') {
          if (shell.toLowerCase().includes('powershell')) ptyArgs.push('-NoLogo');
        } else {
          if (shell.includes('bash') || shell.includes('zsh')) ptyArgs.push('-i', '-l');
        }

        const proc = pty.spawn(shell, ptyArgs, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: shell === 'docker' ? undefined : cwd,
          env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
          useConpty: true,
        });

        const termId = String(proc.pid);
        logger.info({ termId, shell, userId }, 'Spawned new terminal');

        terminals[termId] = {
          process: proc,
          buffer: '',
          metadata: data, // Keep metadata so frontend can restore it
          write:  (d)    => { try { proc.write(d); } catch {} },
          resize: (c, r) => { try { proc.resize(c, r); } catch {} },
          kill:   ()     => { try { proc.kill(); } catch {} },
        };

        proc.onData((output) => {
          const term = terminals[termId];
          if (term) {
            term.buffer += output;
            // Cap history to ~100kb to prevent memory leak
            if (term.buffer.length > 100000) term.buffer = term.buffer.slice(-100000);
          }
          io.to(`user:${userId}`).emit('server:terminal.data', { id: termId, data: output });
        });

        proc.onExit(({ exitCode }) => {
          io.to(`user:${userId}`).emit('server:terminal.exit', { id: termId, exitCode });
          delete terminals[termId];
        });

        if (typeof callback === 'function') callback({ id: termId });
        socket.emit('server:terminal.spawned', { id: termId, requestId: data.requestId });

      } catch (err) {
        logger.error({ err }, 'Failed to spawn terminal');
        if (typeof callback === 'function') callback({ error: err.message });
        else socket.emit('server:terminal.error', { error: err.message });
      }
    });

    socket.on('client:terminal.data', (payload) => {
      const term = terminals[payload.id];
      if (term) term.write(payload.data);
    });

    socket.on('client:terminal.resize', (payload) => {
      const term = terminals[payload.id];
      if (term && payload.cols && payload.rows) {
        term.resize(payload.cols, payload.rows);
      }
    });

    socket.on('client:terminal.kill', (payload) => {
      const term = terminals[payload.id];
      if (term) {
        term.kill();
        delete terminals[payload.id];
      }
    });

    socket.on('client:terminal.check', (payload, callback) => {
      const isAlive = !!terminals[payload.id];
      if (typeof callback === 'function') callback({ alive: isAlive });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'Socket disconnected');
      // Intentionally NOT killing terminals here so they persist for the user.
    });

    socket.on('error', (err) => {
      logger.error({ err, userId }, 'Socket error');
    });
  });

  return io;
}

module.exports = { initSocketGateway };
