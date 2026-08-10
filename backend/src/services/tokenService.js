'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate access + refresh token pair
 */
function generateTokenPair(userId) {
  const accessToken = jwt.sign({ userId: userId.toString() }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(
    { userId: userId.toString(), family: crypto.randomBytes(8).toString('hex') },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

/**
 * Hash a token for secure storage comparison
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
