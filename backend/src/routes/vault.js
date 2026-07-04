'use strict';

// Vault routes — serves encrypted envelopes only; never decrypts on server side
const { Router } = require('express');
const { z } = require('zod');
const { CredentialArtifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validate, validateQuery, paginationSchema } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const VaultItemSchema = z.object({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),
  vaultType: z.enum(['env', 'ssh-key', 'ftp-password', 'api-token', 'generic']),
  title: z.string().min(1).max(200).trim(),
  publicMeta: z.object({
    host: z.string().optional(),
    port: z.number().optional(),
    usernameHint: z.string().optional(),
    protocol: z.string().optional(),
    keyName: z.string().optional(),
    envNameHash: z.string().optional(),
    fingerprint: z.string().optional(),
  }).optional(),
  // Always required — MongoDB only ever sees the envelope, never plaintext
  secretEnvelope: z.object({
    version: z.number(),
    alg: z.string(),
    nonce: z.string(),
    ciphertext: z.string(),
    wrappedKeys: z.array(z.unknown()),
    keyVersion: z.number(),
  }),
  tags: z.array(z.string()).default([]),
});

// GET /api/vault/items
router.get('/items', validateQuery(paginationSchema.extend({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  vaultType: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, workspaceId, vaultType } = req.query;
    const skip = (page - 1) * limit;

    const filter = { ownerId: req.user._id, deletedAt: null };
    if (workspaceId) filter.workspaceId = workspaceId;
    if (vaultType) filter.vaultType = vaultType;

    const [items, total] = await Promise.all([
      CredentialArtifact.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-secretEnvelope') // envelope only returned on explicit fetch
        .lean(),
      CredentialArtifact.countDocuments(filter),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/vault/items — store encrypted vault item
router.post('/items', validate(VaultItemSchema), async (req, res, next) => {
  try {
    const item = await CredentialArtifact.create({
      ownerId: req.user._id,
      kind: 'credential',
      ...req.body,
      'search.privacyClass': 'e2e',
    });

    res.status(201).json({ item: { ...item.toObject(), secretEnvelope: undefined } });
  } catch (err) {
    next(err);
  }
});

// GET /api/vault/items/:id — get encrypted envelope (not decrypted)
router.get('/items/:id', async (req, res, next) => {
  try {
    const item = await CredentialArtifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!item) return res.status(404).json({ error: 'Vault item not found' });

    // Return the encrypted envelope — client decrypts locally
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vault/items/:id
router.delete('/items/:id', async (req, res, next) => {
  try {
    const item = await CredentialArtifact.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!item) return res.status(404).json({ error: 'Vault item not found' });

    res.json({ message: 'Vault item deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
