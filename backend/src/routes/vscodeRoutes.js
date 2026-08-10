const express = require('express');
const router = express.Router();
const vscodeManager = require('../services/vscodeManager');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Require authentication middleware
const { requireAuth } = require('../middleware/auth');

// GET VS Code engine status (includes current workspacePath)
router.get('/status', (req, res) => {
  res.json(vscodeManager.getVscodeStatus());
});

// GET current workspace path
router.get('/workspace-path', requireAuth, (req, res) => {
  res.json({ workspacePath: vscodeManager.getWorkspacePath() });
});

// POST set a new workspace path — restarts the VS Code engine with the new folder
router.post('/workspace-path', requireAuth, async (req, res) => {
  const { workspacePath } = req.body;
  if (!workspacePath || typeof workspacePath !== 'string') {
    return res.status(400).json({ error: 'workspacePath is required' });
  }
  try {
    await vscodeManager.setWorkspacePath(workspacePath);
    res.json({ success: true, workspacePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// GET desktop local state for 1:1 IndexedDB sync
router.get('/local-state', requireAuth, (req, res) => {
  try {
    const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code');
    const stateDbPath = path.join(appDataPath, 'User', 'globalStorage', 'state.vscdb');
    const settingsPath = path.join(appDataPath, 'User', 'settings.json');

    const stateData = {
      _localStorage: {}
    };

    // 1. Read Settings
    let settingsContent = '{}';
    if (fs.existsSync(settingsPath)) {
      settingsContent = fs.readFileSync(settingsPath, 'utf8');
    }

    // 2. Read SQLite state
    if (fs.existsSync(stateDbPath)) {
      try {
        const Database = require('better-sqlite3');
        const db = new Database(stateDbPath, { readonly: true, fileMustExist: true });
        const rows = db.prepare('SELECT key, value FROM ItemTable').all();
        db.close();

        // Convert the SQLite key-value pairs into the IndexedDB format
        // The browser's vscode-web-db stores these in 'vscode-userdata' store.
        
        const records = [];
        for (const row of rows) {
          records.push({ key: row.key, value: row.value });
        }
        
        // Add settings.json to the same store
        records.push({ key: 'settings.json', value: settingsContent });

        stateData['vscode-web-db'] = {
          version: 1,
          data: {
            'vscode-userdata': records
          }
        };

        // If theme is set, push it to local storage as well for immediate load
        const match = settingsContent.match(/"workbench\.colorTheme"\s*:\s*"([^"]+)"/);
        if (match) {
          stateData._localStorage['colorThemeData'] = JSON.stringify({
            id: match[1]
          });
        }
      } catch (dbErr) {
        console.error('Failed to read state.vscdb:', dbErr);
      }
    }

    res.json({ success: true, stateData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
    