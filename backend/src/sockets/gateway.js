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
    const terminals = {};

    socket.on('client:terminal.spawn', (data, callback) => {
      try {
        // Use shell requested by client, fall back to platform default
        const defaultShell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
        let shell = data.shell || defaultShell;
        const cwd = data.cwd || process.env.HOME || process.cwd();
        
        let args = data.args || [];
        if (shell === 'cmd.exe' || shell === 'cmd') {
          shell = 'cmd.exe';
          // Ensure we don't run AutoRun scripts that might launch PowerShell
          if (!args.includes('/d')) args.unshift('/d');
        }

        if (os.platform() === 'win32' && shell === 'bash.exe') {
          const fs = require('fs');
          const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
          if (fs.existsSync(gitBashPath)) {
            shell = gitBashPath;
          }
        }

        require('fs').appendFileSync('C:/Users/Tamimur Rahaman/Desktop/WORKSPACE-FUAD/DEV-DASH/backend/terminal_debug.log', `[SPAWN] data.shell: ${data.shell}, final shell: ${shell}, args: ${args.join(' ')}\n`);

        logger.info({ shell, args, cwd }, 'Spawning terminal');

        const ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols: data.cols || 120,
          rows: data.rows || 30,
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            TERM_PROGRAM: 'DEV_DASH_IDE',
          },
        });

        const termId = ptyProcess.pid.toString();
        terminals[termId] = ptyProcess;

        ptyProcess.onData((output) => {
          socket.emit('server:terminal.data', { id: termId, data: output });
        });

        ptyProcess.onExit(({ exitCode }) => {
          socket.emit('server:terminal.exit', { id: termId, exitCode });
          delete terminals[termId];
        });

        if (typeof callback === 'function') {
          callback({ id: termId });
        } else {
          // Also emit as event in case ACK not supported by client version
          socket.emit('server:terminal.spawned', { id: termId, requestId: data.requestId });
        }
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

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'Socket disconnected');
      // Cleanup terminals
      Object.keys(terminals).forEach((termId) => {
        try {
          terminals[termId].kill();
        } catch (e) {}
      });
    });

    socket.on('error', (err) => {
      logger.error({ err, userId }, 'Socket error');
    });
  });

  return io;
}

module.exports = { initSocketGateway };
