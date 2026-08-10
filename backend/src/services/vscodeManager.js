'use strict';

const { spawn, exec } = require('child_process');
const net    = require('net');
const http   = require('http');
const logger = require('../utils/logger');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// ── Config ───────────────────────────────────────────────────────────────────
const BASE_PORT   = 5550;
const RESTART_MS  = 4000;
const PROBE_TRIES = 40;       // 40 × 800 ms = 32 s max
const PROBE_MS    = 800;

// ── Process state ─────────────────────────────────────────────────────────────
let vscodeProcess = null;
let isReady       = false;
let currentPort   = BASE_PORT;
let restartTimer  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '127.0.0.1');
  });
}

function killPortOwner(port) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    exec(`netstat -ano | findstr ":${port} "`, (err, stdout) => {
      if (err || !stdout) { clearTimeout(timer); return resolve(); }
      const pids = new Set();
      stdout.split('\n').forEach((line) => {
        const m = line.trim().match(/\s+(\d+)\s*$/);
        if (m && m[1] !== '0') pids.add(m[1]);
      });
      if (pids.size === 0) { clearTimeout(timer); return resolve(); }
      logger.info({ port, pids: [...pids] }, 'Killing zombie processes on VS Code port');
      let pending = pids.size;
      pids.forEach((pid) => {
        exec(`taskkill /F /PID ${pid}`, () => { if (--pending === 0) { clearTimeout(timer); setTimeout(resolve, 1500); } });
      });
    });
  });
}

function probeReady(port) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryConnect = () => {
      const sock = new net.Socket();
      sock.setTimeout(PROBE_MS);
      sock.connect(port, '127.0.0.1', () => { sock.destroy(); resolve(true); });
      sock.on('error', retry);
      sock.on('timeout', () => { sock.destroy(); retry(); });
      function retry() {
        if (++attempts < PROBE_TRIES) setTimeout(tryConnect, PROBE_MS);
        else resolve(false);
      }
    };
    tryConnect();
  });
}

function findCodeServerCmd() {
  const cliDir = path.join(os.homedir(), '.vscode', 'cli', 'serve-web');
  if (!fs.existsSync(cliDir)) return null;
  const commits = fs.readdirSync(cliDir).filter(c => {
    try { return fs.statSync(path.join(cliDir, c)).isDirectory(); } catch (e) { return false; }
  });
  for (const commit of commits) {
    const cmdPath = path.join(cliDir, commit, 'bin', 'code-server.cmd');
    if (fs.existsSync(cmdPath)) return cmdPath;
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function startVscode() {
  if (vscodeProcess) return;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }

  // 1. Find a free port
  let portToTry = BASE_PORT;
  while (portToTry < BASE_PORT + 10) {
    if (await isPortFree(portToTry)) break;
    logger.warn({ port: portToTry }, 'Port busy — killing owner…');
    await killPortOwner(portToTry);
    if (await isPortFree(portToTry)) break;
    logger.error({ port: portToTry }, 'Port still busy — trying next');
    portToTry++;
  }
  currentPort = portToTry;
  logger.info({ port: currentPort }, 'Starting Native VS Code Engine…');

  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code');
  const extDir = path.join(os.homedir(), '.vscode', 'extensions');

  const args = [
    '--user-data-dir', appDataDir,
    '--extensions-dir', extDir,
    'serve-web',
    '--port', `${currentPort}`,
    '--host', '127.0.0.1',
    '--accept-server-license-terms',
    '--connection-token', 'devdash-token',
    '--server-base-path', '/vscode',
    '--verbose'
  ];

  try {
    const isWin = os.platform() === 'win32';
    
    let cmd = isWin ? 'code.cmd' : 'code';
    let finalArgs = args;

    let spawnOptions = { 
      env: { ...process.env }, 
      windowsHide: true, 
      shell: isWin 
    };

    if (isWin) {
      const serverCmd = findCodeServerCmd();
      if (serverCmd) {
        // code-server uses slightly different flags if run directly. 
        // We can just pass the same arguments, but we must remove 'serve-web' subcommand and '--verbose' flag.
        finalArgs = finalArgs.filter(a => a !== 'serve-web' && a !== '--verbose');

        // Microsoft's code-server.cmd has a bug with spaces in arguments due to batch string concatenation.
        // We must bypass it and run the underlying Node script directly.
        const rootDir = path.join(path.dirname(serverCmd), '..');
        const serverMain = path.join(rootDir, 'out', 'server-main.js');
        const vscodeNode = path.join(rootDir, 'node.exe');
        
        if (fs.existsSync(serverMain) && fs.existsSync(vscodeNode)) {
          cmd = vscodeNode; // Use VS Code's bundled node.exe
          finalArgs = [serverMain, ...finalArgs, '--log', 'trace'];
          spawnOptions.shell = false;
          logger.info({ serverMain }, 'Running server-main.js directly to bypass cmd bugs');
        } else {
          logger.warn('server-main.js not found, falling back to wrapper');
        }
      } else {
        logger.warn('Could not find code-server binary, falling back to wrapper (may drop extensions-dir)');
      }
    }

    vscodeProcess = spawn(cmd, finalArgs, spawnOptions);
    
    vscodeProcess.stdout.on('data', (d) => logger.debug({ stdout: d.toString() }, 'VS Code Engine Output'));
    vscodeProcess.stderr.on('data', (d) => logger.error({ stderr: d.toString() }, 'VS Code Engine Error'));

    vscodeProcess.on('exit', (code, signal) => {
      logger.warn({ code, signal }, 'VS Code Engine exited — restarting…');
      vscodeProcess = null;
      isReady       = false;
      restartTimer  = setTimeout(startVscode, RESTART_MS);
    });

    vscodeProcess.on('error', (err) => {
      logger.error({ err }, 'Failed to spawn native VS Code Engine. Ensure "code" is in PATH.');
      vscodeProcess = null;
      isReady       = false;
      restartTimer  = setTimeout(startVscode, RESTART_MS);
    });

    logger.info({ port: currentPort }, 'Probing VS Code Engine readiness…');
    let probeTries = 0;
    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${currentPort}/vscode`, (res) => {
        isReady = true;
        logger.info({ port: currentPort }, '✅ Native VS Code Engine is ready');
      });
      req.on('error', (err) => {
        if (probeTries < PROBE_TRIES) {
          probeTries++;
          setTimeout(tryConnect, PROBE_MS);
        } else {
          logger.error('VS Code Engine probe timeout.');
        }
      });
    }
    tryConnect();

  } catch (err) {
    logger.error({ err }, 'Exception spawning VS Code Engine');
    vscodeProcess = null;
    isReady       = false;
    restartTimer  = setTimeout(startVscode, RESTART_MS);
  }
}

function stopVscode() {
  if (vscodeProcess) { try { vscodeProcess.kill(); } catch {} vscodeProcess = null; }
  if (restartTimer)  { clearTimeout(restartTimer); restartTimer = null; }
  isReady = false;
}

function getVscodeStatus() {
  return { ready: isReady, port: currentPort };
}

function getWorkspacePath() { return null; }
async function setWorkspacePath() { /* no-op */ }

module.exports = { startVscode, stopVscode, getVscodeStatus, getWorkspacePath, setWorkspacePath };
