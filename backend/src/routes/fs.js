const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');

const router = express.Router();

// List directory
router.get('/list', async (req, res) => {
  try {
    const dirPath = req.query.dir || process.cwd();
    const resolvedPath = path.resolve(dirPath);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const items = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
    
    const result = items.map(item => ({
      name: item.name,
      path: path.join(resolvedPath, item.name).replace(/\\/g, '/'),
      isDirectory: item.isDirectory()
    })).sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });

    res.json({ path: resolvedPath.replace(/\\/g, '/'), items: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read file
router.get('/read', async (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Write file
router.post('/write', async (req, res) => {
  try {
    const { file, content } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'File path required' });
    }
    // ensure dir exists
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, content, 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create directory
router.post('/mkdir', async (req, res) => {
  try {
    const { targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ error: 'Path required' });
    await fs.promises.mkdir(targetPath, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reveal in OS File Explorer
router.post('/reveal', async (req, res) => {
  try {
    const { targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ error: 'Path required' });
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'Path not found' });
    
    let command = '';
    if (os.platform() === 'win32') {
      command = `explorer.exe /select,"${resolvedPath}"`;
    } else if (os.platform() === 'darwin') {
      command = `open -R "${resolvedPath}"`;
    } else {
      command = `xdg-open "${path.dirname(resolvedPath)}"`;
    }
    
    exec(command);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file or directory
router.post('/delete', async (req, res) => {
  try {
    const { targetPath } = req.body;
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search files
router.get('/search', async (req, res) => {
  try {
    const { root, query } = req.query;
    if (!root || !query) return res.status(400).json({ error: 'root and query required' });
    const results = [];
    const search = async (dir, depth = 0) => {
      if (depth > 6) return;
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.git') continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) { await search(full, depth + 1); }
        else {
          try {
            const content = await fs.promises.readFile(full, 'utf8');
            const lines = content.split('\n');
            const matches = lines.map((text, i) => ({ line: i + 1, text: text.trim() })).filter((m) => m.text.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
            if (matches.length > 0) {
              results.push({ file: item.name, path: full.replace(/\\/g, '/'), content, matches });
            }
          } catch {}
        }
      }
    };
    await search(path.resolve(root));
    res.json({ results: results.slice(0, 50) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pick folder natively (Windows only)
router.get('/pick-folder', (req, res) => {
  if (os.platform() !== 'win32') {
    return res.status(400).json({ error: 'Folder picker only supported on Windows' });
  }
  
  let { defaultPath } = req.query;
  if (!defaultPath) {
    defaultPath = os.homedir();
  }
  
  // Escape backslashes and single quotes for the PowerShell string
  const safeDefaultPath = defaultPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
  
  const script = `
    Add-Type -AssemblyName System.windows.forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.ShowNewFolderButton = $true
    $f.RootFolder = 'MyComputer'
    $f.SelectedPath = '${safeDefaultPath}'
    $hwnd = New-Object System.Windows.Forms.NativeWindow
    $hwnd.AssignHandle([System.Diagnostics.Process]::GetCurrentProcess().MainWindowHandle)
    if ($f.ShowDialog() -eq 'OK') {
      Write-Output $f.SelectedPath
    }
  `.replace(/\n/g, '; ');
  
  exec(`powershell -NoProfile -Sta -Command "${script}"`, (error, stdout) => {
    if (error) {
      console.error('Folder picker error:', error);
      return res.status(500).json({ error: error.message });
    }
    const path = stdout.trim();
    if (!path) {
      return res.json({ canceled: true });
    }
    res.json({ path: path.replace(/\\/g, '/') });
  });
});

// Start code-server engine silently
router.post('/engine/start', (req, res) => {
  if (os.platform() !== 'win32') {
    return res.json({ success: false, reason: 'Only supported on Windows' });
  }

  // Check if already running in WSL
  exec('wsl -d Ubuntu -e bash -c "ps aux | grep code-server | grep -v grep"', { windowsHide: true }, (error, stdout) => {
    if (stdout && stdout.includes('code-server')) {
      return res.json({ success: true, status: 'already_running' });
    }

    const projectRoot = path.resolve(__dirname, '../../../');
    const drive = projectRoot.charAt(0).toLowerCase();
    const wslPath = `/mnt/${drive}${projectRoot.substring(2).replace(/\\/g, '/')}`;

    // Spawn completely detached from Windows Node process to keep it alive
    try {
      const codeServer = spawn('wsl', ['-d', 'Ubuntu', '-e', 'bash', '-c', `code-server --bind-addr 127.0.0.1:8080 --auth none '${wslPath}'`], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      });
      codeServer.unref();
      res.json({ success: true, status: 'started' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

module.exports = router;
