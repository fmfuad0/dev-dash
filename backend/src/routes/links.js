'use strict';

const { Router } = require('express');
const { z } = require('zod');
const ArtifactLink = require('../models/artifactLink');
const { Artifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const CreateLinkSchema = z.object({
  toArtifactId: z.string().regex(/^[a-f\d]{24}$/i),
  relation: z.enum([
    'references',
    'explains',
    'generated-from',
    'fixes-error',
    'uses-credential',
    'belongs-to-canvas',
    'similar-to',
  ]),
  weight: z.number().min(0).max(10).default(1),
});

// GET /api/artifacts/:id/links
router.get('/:id/links', async (req, res, next) => {
  try {
    const artifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).select('_id');

    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    const [outgoing, incoming] = await Promise.all([
      ArtifactLink.find({ fromArtifactId: req.params.id, ownerId: req.user._id })
        .populate('toArtifactId', 'title kind tags')
        .lean(),
      ArtifactLink.find({ toArtifactId: req.params.id, ownerId: req.user._id })
        .populate('fromArtifactId', 'title kind tags')
        .lean(),
    ]);

    res.json({ outgoing, incoming });
  } catch (err) {
    next(err);
  }
});

// POST /api/artifacts/:id/links
router.post('/:id/links', validate(CreateLinkSchema), async (req, res, next) => {
  try {
    const fromArtifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).select('_id workspaceId');

    if (!fromArtifact) return res.status(404).json({ error: 'Artifact not found' });

    const link = await ArtifactLink.create({
      ownerId: req.user._id,
      workspaceId: fromArtifact.workspaceId,
      fromArtifactId: req.params.id,
      toArtifactId: req.body.toArtifactId,
      relation: req.body.relation,
      weight: req.body.weight,
      createdBy: 'user',
    });

    res.status(201).json({ link });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/artifacts/:id/links/:linkId
router.delete('/:id/links/:linkId', async (req, res, next) => {
  try {
    const link = await ArtifactLink.findOneAndDelete({
      _id: req.params.linkId,
      ownerId: req.user._id,
    });

    if (!link) return res.status(404).json({ error: 'Link not found' });

    res.json({ message: 'Link removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
