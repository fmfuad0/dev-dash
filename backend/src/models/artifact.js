'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { EncryptedEnvelopeSchema } = require('./encryptedEnvelope');

// ─── Unified Artifact Schema ─────────────────────────────────────────────────────
const ArtifactBaseSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    tags: [{ type: String, index: true }],

    visibility: {
      type: String,
      enum: ['private', 'workspace', 'team'],
      default: 'private',
    },

    // For non-sensitive artifacts, content may be plaintext
    contentText: { type: String },
    contentEnvelope: EncryptedEnvelopeSchema,

    contentHash: { type: String, index: true },
    language: { type: String, index: true },
    category: { type: String, index: true },
    fileType: { type: String, index: true },

    source: {
      type: {
        type: String,
        enum: ['manual', 'cli', 'terminal', 'git', 'remote', 'ocr', 'import', 'ai'],
        default: 'manual',
      },
      deviceId: { type: Schema.Types.ObjectId, ref: 'Device' },
      path: { type: String },
      cwdHash: { type: String },
      gitCommit: { type: String },
      gitBranch: { type: String },
      remoteConnectionId: { type: Schema.Types.ObjectId },
    },

    // AST indexing metadata
    ast: {
      parser: { type: String },
      parserVersion: { type: String },
      status: {
        type: String,
        enum: ['none', 'queued', 'parsed', 'failed'],
        default: 'none',
      },
      symbols: [
        {
          name: String,
          kind: String,
          loc: {
            startLine: Number,
            startCol: Number,
            endLine: Number,
            endCol: Number,
          },
        },
      ],
      imports: [String],
      exports: [String],
      errors: [String],
      astHash: String,
    },

    // Search indexing metadata
    search: {
      lexicalIndexedAt: Date,
      vectorIndexedAt: Date,
      vectorStatus: {
        type: String,
        enum: ['disabled', 'queued', 'indexed', 'failed'],
        default: 'disabled',
      },
      privacyClass: {
        type: String,
        enum: ['plain', 'sensitive', 'e2e'],
        default: 'plain',
      },
    },

    isPinned: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // --- Flattened fields from legacy discriminators ---

    // From Snippet
    snippetType: {
      type: String,
      enum: ['function', 'component', 'config', 'command', 'error', 'note'],
      default: 'note',
      index: true,
    },
    codeMeta: {
      framework: String,
      packageManager: String,
      runtime: String,
      detectedSecrets: [{ type: String }],
      safeToIndex: { type: Boolean, default: true },
    },
    executionHints: {
      command: String,
      args: [String],
      envKeys: [String],
      requiresConfirmation: { type: Boolean, default: true },
    },

    // From Markdown
    toc: [{ level: Number, text: String, slug: String }],
    wordCount: { type: Number, default: 0 },
    readTimeMinutes: { type: Number, default: 0 },

    // From Canvas
    engine: {
      type: String,
      enum: ['excalidraw', 'react-flow', 'hybrid'],
    },
    canvasJson: { type: Schema.Types.Mixed },
    crdt: {
      provider: { type: String, enum: ['none', 'yjs', 'automerge'], default: 'yjs' },
      snapshot: Buffer,
      stateVector: Buffer,
      updateCount: { type: Number, default: 0 },
      compactedAt: Date,
    },
    layout: {
      viewport: { x: Number, y: Number, zoom: Number },
      bounds: { width: Number, height: Number },
    },

    // From Credential
    vaultType: {
      type: String,
      enum: ['env', 'ssh-key', 'ftp-password', 'api-token', 'generic'],
      index: true,
    },
    publicMeta: {
      host: String,
      port: Number,
      usernameHint: String,
      protocol: {
        type: String,
        enum: ['ssh', 'sftp', 'ftp', 'ftps', 'http', 'generic'],
      },
      keyName: String,
      envNameHash: String,
      fingerprint: String,
    },
    secretEnvelope: { type: EncryptedEnvelopeSchema },
    rotation: {
      keyVersion: { type: Number, default: 1 },
      lastRotatedAt: Date,
      expiresAt: Date,
    },

    // From RemoteConnection
    protocol: {
      type: String,
      enum: ['ssh', 'sftp', 'ftp', 'ftps'],
      index: true,
    },
    host: { type: String },
    port: { type: Number },
    usernameHint: { type: String },
    credentialArtifactId: {
      type: Schema.Types.ObjectId,
      ref: 'Artifact',
      index: true,
    },
    security: {
      knownHostFingerprint: String,
      strictHostKeyChecking: { type: Boolean, default: true },
      allowEphemeralCloudUse: { type: Boolean, default: false },
    },
    defaults: {
      rootPath: String,
      editorMode: {
        type: String,
        enum: ['read-only', 'edit-with-snapshot', 'direct-edit-disabled'],
        default: 'edit-with-snapshot',
      },
    },

    // From TerminalEvent
    shell: {
      type: String,
      enum: ['bash', 'zsh', 'fish', 'powershell', 'unknown'],
      default: 'unknown',
      index: true,
    },
    commandPreview: { type: String },
    commandEnvelope: EncryptedEnvelopeSchema,
    commandHash: { type: String, index: true },
    cwdHash: { type: String, index: true },
    git: {
      repoHash: String,
      branch: String,
      commit: String,
      dirty: Boolean,
    },
    exitCode: Number,
    durationMs: Number,
    capturedAt: { type: Date, index: true },
    classification: {
      type: String,
      enum: ['normal', 'error', 'install', 'git', 'deploy', 'test', 'secret-risk'],
      default: 'normal',
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

// Compound indexes for efficient queries
ArtifactBaseSchema.index({ ownerId: 1, workspaceId: 1, updatedAt: -1 });
ArtifactBaseSchema.index({ ownerId: 1, tags: 1 });
ArtifactBaseSchema.index({ workspaceId: 1, isPinned: 1, updatedAt: -1 });
ArtifactBaseSchema.index({ title: 'text', contentText: 'text', tags: 'text' });
// Partial index for soft-delete pattern
ArtifactBaseSchema.index(
  { ownerId: 1, workspaceId: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

const Artifact = mongoose.model('Artifact', ArtifactBaseSchema);

module.exports = {
  Artifact,
};
