'use strict';

const { Router } = require('express');
const ArtifactVersion = require('../models/artifactVersion');
const { Artifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validateQuery, paginationSchema } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

// GET /api/artifacts/:id/versions
router.get('/:id/versions', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const skip = (page - 1) * limit;

    // Verify ownership
    const artifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).select('_id');

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const [versions, total] = await Promise.all([
      ArtifactVersion.find({ artifactId: req.params.id })
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit)
        .select('-snapshotText') // omit heavy content in list
        .lean(),
      ArtifactVersion.countDocuments({ artifactId: req.params.id }),
    ]);

    res.json({
      versions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/artifacts/:id/versions/:versionNum — get specific version with content
router.get('/:id/versions/:versionNum', async (req, res, next) => {
  try {
    const artifact = await Artifact.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).select('_id');

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const version = await ArtifactVersion.findOne({
      artifactId: req.params.id,
      version: parseInt(req.params.versionNum, 10),
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ version });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
