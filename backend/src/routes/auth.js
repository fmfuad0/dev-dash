'use strict';

const { Router } = require('express');
const { z } = require('zod');
const argon2 = require('argon2');
const User = require('../models/user');
const { generateTokenPair, verifyRefreshToken, hashToken } = require('../services/tokenService');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  displayName: z.string().min(1).max(80).trim().optional(),
});

const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', validate(RegisterSchema), async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await User.create({
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      isVerified: true, // MVP: skip email verification
    });

    const { accessToken, refreshToken } = generateTokenPair(user._id);

    // Store hashed refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    logger.info({ userId: user._id }, 'User registered');

    res.status(201).json({
      user: user.toSafeJSON(),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokenPair(user._id);

    user.refreshTokenHash = hashToken(refreshToken);
    user.lastLoginAt = new Date();
    await user.save();

    logger.info({ userId: user._id }, 'User logged in');

    res.json({
      user: user.toSafeJSON(),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Refresh ──────────────────────────────────────────────────────────────────
router.post('/refresh', validate(RefreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.userId).select('+refreshTokenHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify token matches stored hash (rotation detection)
    if (user.refreshTokenHash !== hashToken(refreshToken)) {
      // Possible token reuse — revoke all sessions
      user.refreshTokenHash = null;
      await user.save();
      return res.status(401).json({ error: 'Refresh token reuse detected. Please login again.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user._id);
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    req.user.refreshTokenHash = null;
    await req.user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
