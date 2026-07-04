const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Clone a GitHub repository to a chosen directory
router.post('/clone', (req, res) => {
  const { repoUrl, targetDir } = req.body;

  if (!repoUrl || !targetDir) {
    return res.status(400).json({ error: 'repoUrl and targetDir are required' });
  }

  // Security: only allow github.com clone URLs
  if (!repoUrl.startsWith('https://github.com/') && !repoUrl.startsWith('git@github.com:')) {
    return res.status(403).json({ error: 'Only github.com repositories are allowed' });
  }

  // Ensure parent dir exists
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: `Failed to create directory: ${err.message}` });
  }

  execFile('git', ['clone', repoUrl], { cwd: targetDir }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }

    // Determine where repo was cloned
    const repoName = repoUrl.split('/').pop().replace('.git', '');
    const clonedPath = path.join(targetDir, repoName).replace(/\\/g, '/');
    res.json({ success: true, clonedPath, message: `Repository cloned to ${clonedPath}` });
  });
});

// Get git status
router.get('/status', (req, res) => {
  const { root } = req.query;
  if (!root) return res.status(400).json({ error: 'root is required' });

  execFile('git', ['status', '--porcelain'], { cwd: root }, (err, stdout) => {
    if (err) {
      if (err.message.includes('not a git repository')) {
        return res.json({ isRepo: false });
      }
      return res.status(500).json({ error: err.message });
    }

    const lines = stdout.split('\n').filter(Boolean);
    const staged = [];
    const unstaged = [];

    lines.forEach((line) => {
      const code = line.substring(0, 2);
      const file = line.substring(3);
      if (code[0] !== ' ' && code[0] !== '?') staged.push({ file, code: code[0] });
      if (code[1] !== ' ') unstaged.push({ file, code: code[1] });
      if (code === '??') unstaged.push({ file, code: 'U' });
    });

    res.json({ isRepo: true, staged, unstaged });
  });
});

// Stage file(s)
router.post('/add', (req, res) => {
  const { root, files } = req.body;
  if (!root || !files) return res.status(400).json({ error: 'root and files required' });
  execFile('git', ['add', ...files], { cwd: root }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Unstage file(s)
router.post('/restore', (req, res) => {
  const { root, files } = req.body;
  if (!root || !files) return res.status(400).json({ error: 'root and files required' });
  execFile('git', ['restore', '--staged', ...files], { cwd: root }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Commit
router.post('/commit', (req, res) => {
  const { root, message } = req.body;
  if (!root || !message) return res.status(400).json({ error: 'root and message required' });
  execFile('git', ['commit', '-m', message], { cwd: root }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, stdout });
  });
});

// Initialize repository
router.post('/init', (req, res) => {
  const { root } = req.body;
  if (!root) return res.status(400).json({ error: 'root is required' });
  execFile('git', ['init'], { cwd: root }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, stdout });
  });
});

// Get git diff
router.get('/diff', (req, res) => {
  const { root, file, staged } = req.query;
  if (!root) return res.status(400).json({ error: 'root is required' });
  const args = ['diff'];
  if (staged === 'true') args.push('--staged');
  if (file) args.push('--', file);
  
  execFile('git', args, { cwd: root, maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, diff: stdout });
  });
});

// Get git log
router.get('/log', (req, res) => {
  const { root, maxCount = 50 } = req.query;
  if (!root) return res.status(400).json({ error: 'root is required' });
  
  execFile('git', ['log', `-n`, maxCount, '--pretty=format:%H|%an|%ae|%ad|%s'], { cwd: root }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    const commits = stdout.split('\n').filter(Boolean).map(line => {
      const [hash, author_name, author_email, date, message] = line.split('|');
      return { hash, author_name, author_email, date, message };
    });
    res.json({ success: true, commits });
  });
});

// Get branches
router.get('/branches', (req, res) => {
  const { root } = req.query;
  if (!root) return res.status(400).json({ error: 'root is required' });
  
  execFile('git', ['branch', '-a'], { cwd: root }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    const branches = [];
    let current = '';
    stdout.split('\n').filter(Boolean).forEach(line => {
      const isCurrent = line.startsWith('*');
      const name = line.replace('*', '').trim();
      if (name && !name.includes('->')) {
        branches.push({ name, current: isCurrent });
        if (isCurrent) current = name;
      }
    });
    res.json({ success: true, branches, current });
  });
});

// Create or switch branch
router.post('/branch', (req, res) => {
  const { root, name, create } = req.body;
  if (!root || !name) return res.status(400).json({ error: 'root and name required' });
  
  const args = create ? ['checkout', '-b', name] : ['checkout', name];
  execFile('git', args, { cwd: root }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message || stderr });
    res.json({ success: true, message: stderr || stdout });
  });
});

// Git Push
router.post('/push', (req, res) => {
  const { root } = req.body;
  if (!root) return res.status(400).json({ error: 'root is required' });
  
  execFile('git', ['push'], { cwd: root }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message || stderr });
    res.json({ success: true, message: stderr || stdout });
  });
});

// Git Pull
router.post('/pull', (req, res) => {
  const { root } = req.body;
  if (!root) return res.status(400).json({ error: 'root is required' });
  
  execFile('git', ['pull'], { cwd: root }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message || stderr });
    res.json({ success: true, message: stdout || stderr });
  });
});

// Git Fetch
router.post('/fetch', (req, res) => {
  const { root } = req.body;
  if (!root) return res.status(400).json({ error: 'root is required' });
  
  execFile('git', ['fetch'], { cwd: root }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message || stderr });
    res.json({ success: true, message: stderr || stdout });
  });
});

module.exports = router;
