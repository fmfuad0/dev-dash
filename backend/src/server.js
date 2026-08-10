'use strict';
 
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

// Inject Docker into PATH for newly installed instances without requiring a system reboot
const dockerPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin');
if (!process.env.PATH.includes('Docker')) {
  process.env.PATH = `${dockerPath}${path.delimiter}${process.env.PATH}`;
}
if (process.env.Path && !process.env.Path.includes('Docker')) {
  process.env.Path = `${dockerPath}${path.delimiter}${process.env.Path}`;
}
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');

const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocketGateway } = require('./sockets/gateway');
const { initQueues } = require('./workers/queues');
const { startVscode, getVscodeStatus } = require('./services/vscodeManager');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const artifactRoutes = require('./routes/artifacts');
const versionRoutes = require('./routes/versions');
const linkRoutes = require('./routes/links');
const searchRoutes = require('./routes/search');
const vaultRoutes = require('./routes/vault');
const syncRoutes = require('./routes/sync');
const deviceRoutes = require('./routes/devices');
const terminalRoutes = require('./routes/terminal');
const remoteRoutes = require('./routes/remote');
const fsRoutes = require('./routes/fs');
const githubAuthRoutes = require('./routes/auth_github');
const gitRoutes = require('./routes/git');
const npmRoutes = require('./routes/npm');
const app = express();
const httpServer = http.createServer(app);

// ─── Security & Compression ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // frontend handles this
}));
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  autoLogging: false
}));

// ─── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/artifacts', artifactRoutes);
app.use('/api/artifacts', versionRoutes);
app.use('/api/artifacts', linkRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/remote', remoteRoutes);
app.use('/api/fs', fsRoutes);
app.use('/api/auth/github', githubAuthRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/npm', npmRoutes);

// ─── VS Code Routes & Proxy ───────────────────────────────────────────────────
const vscodeRoutes = require('./routes/vscodeRoutes');
app.use('/api/vscode', vscodeRoutes);

const { createProxyMiddleware } = require('http-proxy-middleware');

const vscodeProxy = createProxyMiddleware({
  router: () => {
    const status = getVscodeStatus();
    if (!status.ready || !status.port) {
      throw new Error('VS Code Engine not ready');
    }
    return `http://127.0.0.1:${status.port}`;
  },
  ws: true,
  xfwd: true,
  logLevel: 'error',
  onError: (err, req, res) => {
    if (res && !res.headersSent) {
      res.status(502).send('Bad Gateway: VS Code Engine is not reachable');
    }
  }
});  
  
app.use('/vscode', vscodeProxy);  
 
// ─── 404 ──────────────────────────────────────────────────────────────────── ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' }); 
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();
    await connectRedis();

    const queues = initQueues();
    app.set('queues', queues);

    const io = initSocketGateway(httpServer);
    app.set('io', io);

    // Explicitly handle WebSocket upgrades for /vscode
    httpServer.on('upgrade', (req, socket, head) => {
      if (req.url.startsWith('/vscode')) {
        const status = getVscodeStatus();
        if (status.ready && status.port) {
          vscodeProxy.upgrade(req, socket, head);
        } else {
          socket.destroy();
        }
      }
    });

    // Start VS Code Engine daemon
    startVscode();

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to bootstrap server');
    process.exit(1);
  }
}

bootstrap();

module.exports = { app };
