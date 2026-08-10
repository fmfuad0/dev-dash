'use strict';

const { Queue, Worker } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const QUEUE_NAMES = {
  ARTIFACT_INDEX: 'artifact.index',
  AST: 'artifact.index.ast',
  EMBEDDING: 'artifact.index.embedding',
  OCR: 'artifact.ocr',
  SNAPSHOT_COMPACT: 'artifact.snapshot.compact',
};

let queues = null;

/**
 * Initialize all BullMQ queues and workers
 */
function initQueues() {
  const connection = getRedisClient();

  queues = {
    artifactIndex: new Queue(QUEUE_NAMES.ARTIFACT_INDEX, { connection }),
    ast: new Queue(QUEUE_NAMES.AST, { connection }),
    embedding: new Queue(QUEUE_NAMES.EMBEDDING, { connection }),
    ocr: new Queue(QUEUE_NAMES.OCR, { connection }),
    snapshotCompact: new Queue(QUEUE_NAMES.SNAPSHOT_COMPACT, { connection }),
  };

  // ─── Artifact Index Worker ──────────────────────────────────────────────────
  const artifactIndexWorker = new Worker(
    QUEUE_NAMES.ARTIFACT_INDEX,
    async (job) => {
      const { artifactId, category, workspaceId } = job.data;
      logger.info({ artifactId, category }, 'Indexing artifact');

      // Queue AST parsing for code artifacts
      if (['Code snippet', 'Script', 'Function', 'Markdown', 'File'].includes(category)) {
        await queues.ast.add('ast.parse', { artifactId }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        });
      }
    },
    {
      connection: connection.duplicate(),
      concurrency: 5,
    }
  );

  // ─── AST Worker ─────────────────────────────────────────────────────────────
  const astWorker = new Worker(
    QUEUE_NAMES.AST,
    async (job) => {
      const { artifactId } = job.data;
      logger.info({ artifactId }, 'AST parse job (stub — Phase 4 implementation)');
      // Phase 4: parse code with babel/tree-sitter, update artifact.ast
    },
    {
      connection: connection.duplicate(),
      concurrency: 3,
    }
  );

  // ─── Error Handling ──────────────────────────────────────────────────────────
  for (const [name, worker] of Object.entries({
    artifactIndex: artifactIndexWorker,
    ast: astWorker,
  })) {
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: name, err }, 'Worker job failed');
    });
    worker.on('error', (err) => {
      logger.error({ queue: name, err }, 'Worker error');
    });
  }

  logger.info('✅ BullMQ queues and workers initialized');
  return queues;
}

function getQueues() {
  if (!queues) throw new Error('Queues not initialized');
  return queues;
}

module.exports = { initQueues, getQueues, QUEUE_NAMES };
