'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { TerminalEventArtifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validate, validateQuery, paginationSchema } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const CaptureSchema = z.object({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),
  commandPreview: z.string().max(500),
  commandHash: z.string().min(1),
  shell: z.enum(['bash', 'zsh', 'fish', 'powershell', 'unknown']).default('unknown'),
  cwdHash: z.string().optional(),
  exitCode: z.number().optional(),
  durationMs: z.number().optional(),
  capturedAt: z.string().datetime(),
  classification: z
    .enum(['normal', 'error', 'install', 'git', 'deploy', 'test', 'secret-risk'])
    .default('normal'),
  git: z
    .object({
      repoHash: z.string(),
      branch: z.string(),
      commit: z.string(),
      dirty: z.boolean(),
    })
    .optional(),
  // Encrypted command for E2E workspaces
  commandEnvelope: z.unknown().optional(),
});

// GET /api/terminal/events
router.get('/events', validateQuery(paginationSchema.extend({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  classification: z.string().optional(),
  shell: z.string().optional(),
  since: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, workspaceId, classification, shell, since } = req.query;
    const skip = (page - 1) * limit;

    const filter = { ownerId: req.user._id, deletedAt: null };
    if (workspaceId) filter.workspaceId = workspaceId;
    if (classification) filter.classification = classification;
    if (shell) filter.shell = shell;
    if (since) filter.capturedAt = { $gte: new Date(since) };

    const [events, total] = await Promise.all([
      TerminalEventArtifact.find(filter)
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TerminalEventArtifact.countDocuments(filter),
    ]);

    res.json({
      events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/terminal/events — capture terminal event
router.post('/events', validate(CaptureSchema), async (req, res, next) => {
  try {
    const event = await TerminalEventArtifact.create({
      ownerId: req.user._id,
      kind: 'terminalEvent',
      title: req.body.commandPreview?.slice(0, 100) || 'Terminal event',
      ...req.body,
      source: { type: 'terminal' },
    });

    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
