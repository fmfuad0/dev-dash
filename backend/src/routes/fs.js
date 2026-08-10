const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');
const remoteFs = require('../utils/remoteFs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// List directory
router.get('/list', async (req, res) => {
  try {
    const { dir, provider, connectionId } = req.query;
    
    if (provider === 'remote') {
      if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
      const result = await remoteFs.listDir(connectionId, req.user._id, dir || '.');
      return res.json(result);
    }

    const dirPath = dir || process.cwd();
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
    const { file, provider, connectionId } = req.query;
    
    if (provider === 'remote') {
      if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
      const content = await remoteFs.readFile(connectionId, req.user._id, file);
      return res.json({ content });
    }

    if (!file || !fs.existsSync(file)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = await fs.promises.readFile(file, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Write file
router.post('/write', async (req, res) => {
  try {
    const { file, content, provider, connectionId } = req.body;
    
    if (provider === 'remote') {
      if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
      await remoteFs.writeFile(connectionId, req.user._id, file, content);
      return res.json({ success: true });
    }

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

// Rename
router.post('/rename', async (req, res) => {
  try {
    const { oldPath, newPath, provider, connectionId } = req.body;
    
    if (provider === 'remote') {
      if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
      await remoteFs.renamePath(connectionId, req.user._id, oldPath, newPath);
      return res.json({ success: true });
    }

    if (!oldPath || !newPath) return res.status(400).json({ error: 'Paths required' });
    await fs.promises.rename(oldPath, newPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file or directory
router.delete('/delete', async (req, res) => {
  try {
    const { targetPath, provider, connectionId } = req.body;
    
    if (provider === 'remote') {
      if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
      await remoteFs.deletePath(connectionId, req.user._id, targetPath);
      return res.json({ success: true });
    }

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

// List all available drives (Windows-first, cross-platform fallback)
router.get('/drives', async (req, res) => {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      // Use wmic to enumerate logical disks
      exec('wmic logicaldisk get Caption,DriveType,VolumeName /format:csv', (err, stdout) => {
        if (err) {
          // Fallback: use simple drive letter scan
          const drives = [];
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const checks = letters.map(letter => {
            return new Promise((resolve) => {
              const drivePath = `${letter}:\\`;
              fs.access(drivePath, fs.constants.F_OK, (e) => {
                if (!e) drives.push({ name: `${letter}:`, path: `${letter}:/`, type: 'drive' });
                resolve();
              });
            });
          });
          Promise.all(checks).then(() => res.json({ drives }));
          return;
        }
        // Parse wmic CSV output
        const lines = stdout.trim().split('\n').filter(Boolean);
        const drives = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 3) {
            const caption = parts[1]?.trim();
            const driveType = parts[2]?.trim();
            const volumeName = parts[3]?.trim() || '';
            if (caption && /^[A-Z]:$/i.test(caption)) {
              const typeLabel = {
                '2': 'Removable',
                '3': 'Local',
                '4': 'Network',
                '5': 'CD/DVD',
                '6': 'RAM Disk'
              }[driveType] || 'Drive';
              drives.push({
                name: volumeName ? `${caption} (${volumeName})` : caption,
                path: `${caption}/`,
                type: typeLabel,
                letter: caption
              });
            }
          }
        }
        res.json({ drives });
      });
    } else {
      // Linux/macOS: return mounted filesystems
      exec('df -h --output=target 2>/dev/null || df -h | awk "NR>1 {print $6}"', (err, stdout) => {
        const lines = stdout.trim().split('\n').filter(l => l && l.startsWith('/'));
        const drives = lines.map(l => ({ name: l.trim(), path: l.trim(), type: 'Mount' }));
        res.json({ drives: drives.length ? drives : [{ name: '/', path: '/', type: 'Root' }] });
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Copy file or directory
router.post('/copy', async (req, res) => {
  try {
    const { sourcePath, sourceProvider, sourceConnectionId, targetPath, targetProvider, targetConnectionId } = req.body;
    
    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: 'Source and target paths are required' });
    }

    // Remote to Remote (same connection for now)
    if (sourceProvider === 'remote' && targetProvider === 'remote') {
      if (sourceConnectionId !== targetConnectionId) {
        return res.status(400).json({ error: 'Cross-connection copy not supported yet' });
      }
      await remoteFs.copyPath(sourceConnectionId, req.user._id, sourcePath, targetPath);
      return res.json({ success: true });
    }
    
    // Local to Local
    if (sourceProvider === 'local' && targetProvider === 'local') {
      const src = path.resolve(sourcePath);
      const dest = path.resolve(targetPath);
      
      const stat = await fs.promises.stat(src);
      if (stat.isDirectory()) {
        await fs.promises.cp(src, dest, { recursive: true });
      } else {
        await fs.promises.copyFile(src, dest);
      }
      return res.json({ success: true });
    }
    
    return res.status(400).json({ error: 'Cross-provider copy not supported yet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
