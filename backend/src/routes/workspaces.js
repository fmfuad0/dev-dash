'use strict';

const { Router } = require('express');
const { z } = require('zod');
const Workspace = require('../models/workspace');
const { requireAuth } = require('../middleware/auth');
const { validate, validateQuery, paginationSchema } = require('../middleware/validate');
const logger = require('../utils/logger');

const router = Router();
router.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────────────────────────────
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes'),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  privacyMode: z.enum(['standard', 'e2e', 'local-only']).default('standard'),
});

const UpdateWorkspaceSchema = CreateWorkspaceSchema.partial();

// ─── List Workspaces ──────────────────────────────────────────────────────────
router.get('/', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const skip = (page - 1) * limit;

    const [workspaces, total] = await Promise.all([
      Workspace.find({ ownerId: req.user._id, isArchived: false })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Workspace.countDocuments({ ownerId: req.user._id, isArchived: false }),
    ]);

    res.json({
      workspaces,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Create Workspace ─────────────────────────────────────────────────────────
router.post('/', validate(CreateWorkspaceSchema), async (req, res, next) => {
  try {
    const workspace = await Workspace.create({
      ...req.body,
      ownerId: req.user._id,
    });

    logger.info({ workspaceId: workspace._id, userId: req.user._id }, 'Workspace created');
    res.status(201).json({ workspace });
  } catch (err) {
    next(err);
  }
});

// ─── Get Workspace ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

// ─── Update Workspace ─────────────────────────────────────────────────────────
router.patch('/:id', validate(UpdateWorkspaceSchema), async (req, res, next) => {
  try {
    const workspace = await Workspace.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

// ─── Archive Workspace ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const workspace = await Workspace.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ message: 'Workspace archived', workspace });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
