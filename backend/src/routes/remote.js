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
const RemoteConnection = require('../models/RemoteConnection');

// Get all remote connections for the user
router.get('/connections', async (req, res) => {
  try {
    const connections = await RemoteConnection.find({ userId: req.user._id }).select('-password -privateKey');
    res.json({ connections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new remote connection
router.post('/connections', async (req, res) => {
  try {
    const { name, host, port, username, password, privateKey } = req.body;
    
    // Check if name exists
    const existing = await RemoteConnection.findOne({ userId: req.user._id, name });
    if (existing) {
      return res.status(400).json({ error: 'A connection with this name already exists' });
    }

    const conn = new RemoteConnection({
      userId: req.user._id,
      name, host, port, username, password, privateKey
    });
    await conn.save();
    
    res.status(201).json({ connection: { _id: conn._id, name: conn.name, host: conn.host } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a connection
router.put('/connections/:id', async (req, res) => {
  try {
    const { name, host, port, username, password, privateKey } = req.body;
    
    // Check if name exists for a DIFFERENT connection
    const existing = await RemoteConnection.findOne({ userId: req.user._id, name });
    if (existing && existing._id.toString() !== req.params.id) {
      return res.status(400).json({ error: 'A connection with this name already exists' });
    }

    const updated = await RemoteConnection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, host, port, username, password, privateKey },
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ error: 'Connection not found' });
    
    res.json({ connection: { _id: updated._id, name: updated.name, host: updated.host } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a connection
router.delete('/connections/:id', async (req, res) => {
  try {
    await RemoteConnection.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
