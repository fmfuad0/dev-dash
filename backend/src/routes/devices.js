'use strict';

const { Router } = require('express');
const { z } = require('zod');
const Device = require('../models/device');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const RegisterDeviceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  platform: z.enum(['darwin', 'linux', 'win32', 'browser', 'unknown']).default('unknown'),
  publicEncryptionKey: z.string().min(1),
  publicSigningKey: z.string().min(1),
  daemonVersion: z.string().optional(),
  fingerprint: z.string().optional(),
});

// GET /api/devices
router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

// POST /api/devices — register new device
router.post('/', validate(RegisterDeviceSchema), async (req, res, next) => {
  try {
    const device = await Device.create({
      userId: req.user._id,
      ...req.body,
      trustStatus: 'trusted', // MVP: auto-trust; production would require approval
      lastSeenAt: new Date(),
    });

    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/devices/:id/heartbeat
router.patch('/:id/heartbeat', async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { lastSeenAt: new Date() } },
      { new: true }
    );

    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({ lastSeenAt: device.lastSeenAt });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/devices/:id — revoke device
router.delete('/:id', async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { trustStatus: 'revoked' } },
      { new: true }
    );

    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({ message: 'Device revoked', deviceId: device._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
