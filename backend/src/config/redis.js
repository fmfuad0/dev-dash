'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let client = null;

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client = new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  client.on('connect', () => logger.info('✅ Redis connected'));
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await client.connect();
  return client;
}

function getRedisClient() {
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
}

module.exports = { connectRedis, getRedisClient };
