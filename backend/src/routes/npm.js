const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const router = express.Router();

// Search NPM registry
router.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`;
  
  https.get(url, (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const results = parsed.objects.map((obj) => ({
          name: obj.package.name,
          version: obj.package.version,
          description: obj.package.description,
          author: obj.package.publisher?.username || obj.package.author?.name || 'unknown'
        }));
        res.json({ results });
      } catch (err) {
        res.status(500).json({ error: 'Failed to parse registry response' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// Get installed packages
router.get('/installed', (req, res) => {
  const { root } = req.query;
  if (!root) return res.status(400).json({ error: 'root is required' });

  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return res.json({ installed: [], isNodeProject: false });
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).map(k => ({ name: k, version: pkg.dependencies[k], type: 'prod' }));
    const devDeps = Object.keys(pkg.devDependencies || {}).map(k => ({ name: k, version: pkg.devDependencies[k], type: 'dev' }));
    res.json({ installed: [...deps, ...devDeps], isNodeProject: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read package.json' });
  }
});

// Install package
router.post('/install', (req, res) => {
  const { root, pkg, isDev } = req.body;
  if (!root || !pkg) return res.status(400).json({ error: 'root and pkg required' });

  const args = ['install', pkg];
  if (isDev) args.push('--save-dev');

  // Need to run via shell to execute npm correctly on Windows (.cmd)
  execFile('npm', args, { cwd: root, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    res.json({ success: true, stdout });
  });
});

// Uninstall package
router.post('/uninstall', (req, res) => {
  const { root, pkg } = req.body;
  if (!root || !pkg) return res.status(400).json({ error: 'root and pkg required' });

  execFile('npm', ['uninstall', pkg], { cwd: root, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    res.json({ success: true, stdout });
  });
});

module.exports = router;
