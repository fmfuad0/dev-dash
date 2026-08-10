'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { Artifact } = require('../models/artifact');
const { requireAuth } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

const SearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  categories: z.string().optional(), // comma-separated
  tags: z.string().optional(),
  language: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

// GET /api/search — fuzzy and lexical text search
router.get('/', validateQuery(SearchQuerySchema), async (req, res, next) => {
  try {
    const { q, workspaceId, categories, tags, language, limit, page } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      ownerId: req.user._id,
      deletedAt: null,
    };

    if (workspaceId) filter.workspaceId = workspaceId;
    if (categories) {
      filter.category = { $in: categories.split(',').map((k) => k.trim()) };
    }
    if (tags) {
      filter.tags = { $in: tags.split(',').map((t) => t.trim()) };
    }
    if (language) filter.language = language;

    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fuzzyRegex = new RegExp(escapedQ.split(/\s+/).join('.*?'), 'i');
      filter.$or = [
        { title: { $regex: fuzzyRegex } },
        { description: { $regex: fuzzyRegex } },
        { tags: { $regex: fuzzyRegex } },
        { category: { $regex: fuzzyRegex } },
        { language: { $regex: fuzzyRegex } },
        { fileType: { $regex: fuzzyRegex } }
      ];
    }

    // Since we use $or with $text, we cannot use $meta textScore for projection or sorting.
    // We will just sort by updatedAt descending.
    const sort = { updatedAt: -1 };

    const [results, total] = await Promise.all([
      Artifact.find(filter)
        .sort(sort)
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

// GET /api/search/suggestions — get top categories and languages
router.get('/suggestions', async (req, res, next) => {
  try {
    const match = { ownerId: req.user._id, deletedAt: null };
    const [categories, languages] = await Promise.all([
      Artifact.aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Artifact.aggregate([
        { $match: match },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);
    
    res.json({
      categories: categories.map(c => c._id).filter(Boolean),
      languages: languages.map(l => l._id).filter(Boolean)
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
