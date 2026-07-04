'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/**
 * Phase 3 — Remote Connection Manager
 * SSH/SFTP/FTP browser, file editor, pre-save snapshots.
 * Implemented in Phase 3 of the roadmap.
 */
router.get('/connections', (_req, res) => {
  res.json({ connections: [], message: 'Remote connections — available in Phase 3' });
});

router.get('/sessions', (_req, res) => {
  res.json({ sessions: [], message: 'Remote sessions — available in Phase 3' });
});

module.exports = router;
