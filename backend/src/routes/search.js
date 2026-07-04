'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { Artifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  kinds: z.string().optional(), // comma-separated
  tags: z.string().optional(),
  language: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

// GET /api/search — lexical text search
router.get('/', validateQuery(SearchQuerySchema), async (req, res, next) => {
  try {
    const { q, workspaceId, kinds, tags, language, limit, page } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      ownerId: req.user._id,
      deletedAt: null,
      $text: { $search: q },
    };

    if (workspaceId) filter.workspaceId = workspaceId;
    if (kinds) {
      filter.kind = { $in: kinds.split(',').map((k) => k.trim()) };
    }
    if (tags) {
      filter.tags = { $in: tags.split(',').map((t) => t.trim()) };
    }
    if (language) filter.language = language;

    const [results, total] = await Promise.all([
      Artifact.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-contentText -contentEnvelope')
        .lean(),
      Artifact.countDocuments(filter),
    ]);

    res.json({
      query: q,
      results,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/search/tags — list all tags in a workspace
router.get('/tags', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const match = { ownerId: req.user._id, deletedAt: null };
    if (workspaceId) match.workspaceId = workspaceId;

    const tags = await Artifact.distinct('tags', match);
    res.json({ tags: tags.sort() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
