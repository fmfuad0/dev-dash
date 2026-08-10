'use strict';

const { Router } = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { Artifact } = require('../models/artifact');
const ArtifactVersion = require('../models/artifactVersion');
const Workspace = require('../models/workspace');
const { requireAuth } = require('../middleware/auth');
const { validate, validateQuery, paginationSchema } = require('../middleware/validate');
const logger = require('../utils/logger');

const router = Router();
router.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────────────────────────────
const CreateArtifactSchema = z.object({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),

  title: z.string().min(1).max(240).trim(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  contentText: z.string().max(2_000_000).optional(), // 2MB max
  contentEnvelope: z.unknown().optional(),
  language: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  fileType: z.string().max(100).optional(),
  visibility: z.enum(['private', 'workspace', 'team']).default('private'),
  isPinned: z.boolean().default(false),
  // Discriminator-specific fields passed through
  snippetType: z.string().optional(),
  codeMeta: z.unknown().optional(),
  engine: z.string().optional(),
  vaultType: z.string().optional(),
  secretEnvelope: z.unknown().optional(),
  protocol: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  credentialArtifactId: z.string().optional(),
});

const UpdateArtifactSchema = z.object({
  title: z.string().min(1).max(240).trim().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  contentText: z.string().max(2_000_000).optional(),
  contentEnvelope: z.unknown().optional(),
  language: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  fileType: z.string().max(100).optional(),
  visibility: z.enum(['private', 'workspace', 'team']).optional(),
  isPinned: z.boolean().optional(),
  changeNote: z.string().max(500).optional(),
});

const ListArtifactsQuerySchema = paginationSchema.extend({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),

  tags: z.string().optional(), // comma-separated
  language: z.string().optional(),
  category: z.string().optional(),
  fileType: z.string().optional(),
  pinned: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
});

// Helper — verify workspace ownership
async function assertWorkspaceAccess(userId, workspaceId) {
  const ws = await Workspace.findOne({ _id: workspaceId, ownerId: userId });
  if (!ws) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  return ws;
}

// Helper — compute content hash
function hashContent(text) {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── List Artifacts ───────────────────────────────────────────────────────────
router.get('/', validateQuery(ListArtifactsQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, workspaceId, tags, language, pinned, q } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      ownerId: req.user._id,
      deletedAt: null,
    };

    if (workspaceId) filter.workspaceId = workspaceId;

    if (language) filter.language = language;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.fileType) filter.fileType = req.query.fileType;
    if (pinned !== undefined) filter.isPinned = pinned;
    if (tags) {
      const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagArr.length) filter.tags = { $in: tagArr };
    }

    // Text search
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fuzzyRegex = new RegExp(escapedQ.split(/\s+/).join('.*?'), 'i');
      filter.$or = [
        { title: { $regex: fuzzyRegex } },
        { tags: { $regex: fuzzyRegex } },
        { category: { $regex: fuzzyRegex } },
        { language: { $regex: fuzzyRegex } },
        { fileType: { $regex: fuzzyRegex } }
      ];
    }

    const sort = { updatedAt: -1 };

    const [artifacts, total] = await Promise.all([
      Artifact.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-contentText -contentEnvelope') // omit heavy fields in list
        .lean(),
      Artifact.countDocuments(filter),
    ]);

    res.json({
      artifacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Create Artifact ──────────────────────────────────────────────────────────
router.post('/', validate(CreateArtifactSchema), async (req, res, next) => {
  try {
    const { workspaceId, contentText, changeNote, category, ...rest } = req.body;

    // Validate workspace access
    await assertWorkspaceAccess(req.user._id, workspaceId);

    // Credential artifacts MUST use encrypted envelopes
    if (category === 'Vault' && !rest.secretEnvelope) {
      return res.status(400).json({
        error: 'Credential artifacts must use encrypted envelopes (secretEnvelope)',
      });
    }

    const artifact = await Artifact.create({
      ownerId: req.user._id,
      workspaceId,
      category,
      contentText,
      contentHash: hashContent(contentText),
      ...rest,
    });

    // Create initial version
    await ArtifactVersion.create({
      artifactId: artifact._id,
      ownerId: req.user._id,
      workspaceId,
      version: 1,
      contentHash: artifact.contentHash || 'empty',
      snapshotText: contentText,
      source: { type: 'manual' },
      changeNote: changeNote || 'Initial version',
    });

    // Queue indexing job
    const queues = req.app.get('queues');
    if (queues?.artifactIndex) {
      await queues.artifactIndex.add('artifact.index', {
        artifactId: artifact._id.toString(),
        category,
        workspaceId,
      });
    }

    // Emit Socket.IO event
    req.app.get('io')?.to(`user:${req.user._id}`).emit('server:artifact.created', {
      artifactId: artifact._id,
      workspaceId,
      category,
    });

    logger.info({ artifactId: artifact._id, category }, 'Artifact created');
    res.status(201).json({ artifact });
  } catch (err) {
    next(err);
  }
});

// ─── Get Stats ────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const filter = {
      ownerId: req.user._id,
      deletedAt: null,
    };
    if (workspaceId) filter.workspaceId = workspaceId;

    const artifacts = await Artifact.find(filter)
      .select('tags category fileType updatedAt')
      .lean();

    res.json({ artifacts });
  } catch (err) {
    next(err);
  }
});

// ─── Get Artifact ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const artifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
      deletedAt: null,
    });

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json({ artifact });
  } catch (err) {
    next(err);
  }
});

// ─── Update Artifact ──────────────────────────────────────────────────────────
router.patch('/:id', validate(UpdateArtifactSchema), async (req, res, next) => {
  try {
    const { changeNote, contentText, ...rest } = req.body;

    const artifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
      deletedAt: null,
    });

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const newHash = hashContent(contentText || artifact.contentText);
    const contentChanged = contentText !== undefined && newHash !== artifact.contentHash;

    Object.assign(artifact, rest);
    if (contentText !== undefined) {
      artifact.contentText = contentText;
      artifact.contentHash = newHash;
    }

    await artifact.save();

    // Create new version if content changed
    if (contentChanged) {
      const lastVersion = await ArtifactVersion.findOne({ artifactId: artifact._id })
        .sort({ version: -1 })
        .select('version');

      await ArtifactVersion.create({
        artifactId: artifact._id,
        ownerId: req.user._id,
        workspaceId: artifact.workspaceId,
        version: (lastVersion?.version || 0) + 1,
        contentHash: newHash,
        snapshotText: contentText,
        source: { type: 'manual' },
        changeNote: changeNote || 'Updated content',
      });
    }

    // Emit update event
    req.app.get('io')?.to(`user:${req.user._id}`).emit('server:artifact.updated', {
      artifactId: artifact._id,
      workspaceId: artifact.workspaceId,
    });

    res.json({ artifact });
  } catch (err) {
    next(err);
  }
});

// ─── Soft Delete Artifact ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const artifact = await Artifact.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    req.app.get('io')?.to(`user:${req.user._id}`).emit('server:artifact.deleted', {
      artifactId: artifact._id,
      workspaceId: artifact.workspaceId,
    });

    res.json({ message: 'Artifact deleted', artifactId: artifact._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
