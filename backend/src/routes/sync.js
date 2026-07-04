'use strict';

const { Router } = require('express');
const { z } = require('zod');
const SyncMutation = require('../models/syncMutation');
const { Artifact } = require('../models/artifact');
const ArtifactVersion = require('../models/artifactVersion');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const router = Router();
router.use(requireAuth);

const MutationSchema = z.object({
  mutationId: z.string().uuid(),
  deviceId: z.string().regex(/^[a-f\d]{24}$/i),
  clientSeq: z.number().int().min(0),
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),
  op: z.enum([
    'artifact.create',
    'artifact.update',
    'artifact.delete',
    'artifact.link',
    'vault.upsert',
    'canvas.crdtUpdate',
    'remote.snapshot',
    'terminal.capture',
  ]),
  hybridLogicalClock: z.string(),
  payload: z.unknown(),
  signature: z.string().optional(),
});

const PushSchema = z.object({
  mutations: z.array(MutationSchema).min(1).max(50),
});

// POST /api/sync/push — idempotent batch mutation push
router.post('/push', validate(PushSchema), async (req, res, next) => {
  try {
    const { mutations } = req.body;
    const results = [];
    let serverSeq = Date.now();

    for (const mutation of mutations) {
      // Idempotency — skip if already processed
      const existing = await SyncMutation.findOne({
        mutationId: mutation.mutationId,
        ownerId: req.user._id,
      });

      if (existing) {
        results.push({
          mutationId: mutation.mutationId,
          status: existing.status,
          serverSeq: existing.serverSeq,
        });
        continue;
      }

      // Apply mutation
      let status = 'applied';
      let error = null;

      try {
        await applyMutation(req.user._id, mutation);
      } catch (err) {
        logger.error({ err, mutation }, 'Mutation apply failed');
        status = 'rejected';
        error = { code: 'APPLY_FAILED', message: err.message };
      }

      const stored = await SyncMutation.create({
        ownerId: req.user._id,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
        clientSeq: mutation.clientSeq,
        serverSeq: serverSeq++,
        workspaceId: mutation.workspaceId,
        op: mutation.op,
        payload: mutation.payload,
        status,
        error,
        hybridLogicalClock: mutation.hybridLogicalClock,
        signature: mutation.signature,
      });

      results.push({
        mutationId: mutation.mutationId,
        status: stored.status,
        serverSeq: stored.serverSeq,
      });
    }

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/pull — pull mutations since a server sequence
router.get('/pull', async (req, res, next) => {
  try {
    const since = parseInt(req.query.since || '0', 10);
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);

    const mutations = await SyncMutation.find({
      ownerId: req.user._id,
      serverSeq: { $gt: since },
      status: 'applied',
    })
      .sort({ serverSeq: 1 })
      .limit(limit)
      .lean();

    res.json({
      mutations,
      hasMore: mutations.length === limit,
      latestSeq: mutations[mutations.length - 1]?.serverSeq || since,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Mutation Applier ─────────────────────────────────────────────────────────
async function applyMutation(userId, mutation) {
  const { op, payload, workspaceId } = mutation;

  switch (op) {
    case 'artifact.create': {
      await Artifact.create({
        ownerId: userId,
        workspaceId,
        ...payload,
      });
      break;
    }
    case 'artifact.update': {
      const { artifactId, ...updates } = payload;
      await Artifact.findOneAndUpdate(
        { _id: artifactId, ownerId: userId },
        { $set: updates }
      );
      break;
    }
    case 'artifact.delete': {
      await Artifact.findOneAndUpdate(
        { _id: payload.artifactId, ownerId: userId },
        { $set: { deletedAt: new Date() } }
      );
      break;
    }
    case 'terminal.capture': {
      await Artifact.create({
        ownerId: userId,
        workspaceId,
        kind: 'terminalEvent',
        title: payload.commandPreview?.slice(0, 100) || 'Terminal event',
        ...payload,
        source: { ...payload.source, type: 'terminal' },
      });
      break;
    }
    // Other ops handled by their own services
    default:
      logger.warn({ op }, 'Unhandled sync mutation op');
  }
}

module.exports = router;
