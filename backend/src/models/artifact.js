'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { EncryptedEnvelopeSchema } = require('./encryptedEnvelope');

// ─── Base Artifact Schema ─────────────────────────────────────────────────────
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

    kind: {
      type: String,
      required: true,
      enum: [
        'snippet',
        'markdown',
        'canvas',
        'credential',
        'remoteConnection',
        'terminalEvent',
        'image',
        'remoteFile',
        'astIndex',
      ],
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
  },
  {
    timestamps: true,
    discriminatorKey: 'kind',
    minimize: false,
  }
);

// Compound indexes for efficient queries
ArtifactBaseSchema.index({ ownerId: 1, workspaceId: 1, kind: 1, updatedAt: -1 });
ArtifactBaseSchema.index({ ownerId: 1, tags: 1 });
ArtifactBaseSchema.index({ workspaceId: 1, isPinned: 1, updatedAt: -1 });
ArtifactBaseSchema.index({ title: 'text', contentText: 'text', tags: 'text' });
// Partial index for soft-delete pattern
ArtifactBaseSchema.index(
  { ownerId: 1, workspaceId: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: null } }
);

const Artifact = mongoose.model('Artifact', ArtifactBaseSchema);

// ─── Snippet Discriminator ────────────────────────────────────────────────────
const SnippetArtifact = Artifact.discriminator(
  'snippet',
  new Schema({
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
  })
);

// ─── Markdown Discriminator ───────────────────────────────────────────────────
const MarkdownArtifact = Artifact.discriminator(
  'markdown',
  new Schema({
    toc: [{ level: Number, text: String, slug: String }],
    wordCount: { type: Number, default: 0 },
    readTimeMinutes: { type: Number, default: 0 },
  })
);

// ─── Canvas Discriminator ─────────────────────────────────────────────────────
const CanvasArtifact = Artifact.discriminator(
  'canvas',
  new Schema({
    engine: {
      type: String,
      enum: ['excalidraw', 'react-flow', 'hybrid'],
      required: true,
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
  })
);

// ─── Credential Discriminator ─────────────────────────────────────────────────
const CredentialArtifact = Artifact.discriminator(
  'credential',
  new Schema({
    vaultType: {
      type: String,
      enum: ['env', 'ssh-key', 'ftp-password', 'api-token', 'generic'],
      required: true,
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
    secretEnvelope: { type: require('./encryptedEnvelope').EncryptedEnvelopeSchema, required: true },
    rotation: {
      keyVersion: { type: Number, default: 1 },
      lastRotatedAt: Date,
      expiresAt: Date,
    },
  })
);

// ─── Remote Connection Discriminator ─────────────────────────────────────────
const RemoteConnectionArtifact = Artifact.discriminator(
  'remoteConnection',
  new Schema({
    protocol: {
      type: String,
      enum: ['ssh', 'sftp', 'ftp', 'ftps'],
      required: true,
      index: true,
    },
    host: { type: String, required: true },
    port: { type: Number, required: true },
    usernameHint: { type: String },
    credentialArtifactId: {
      type: Schema.Types.ObjectId,
      ref: 'Artifact',
      required: true,
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
  })
);

// ─── Terminal Event Discriminator ─────────────────────────────────────────────
const TerminalEventArtifact = Artifact.discriminator(
  'terminalEvent',
  new Schema({
    shell: {
      type: String,
      enum: ['bash', 'zsh', 'fish', 'powershell', 'unknown'],
      default: 'unknown',
      index: true,
    },
    commandPreview: { type: String },
    commandEnvelope: require('./encryptedEnvelope').EncryptedEnvelopeSchema,
    commandHash: { type: String, required: true, index: true },
    cwdHash: { type: String, index: true },
    git: {
      repoHash: String,
      branch: String,
      commit: String,
      dirty: Boolean,
    },
    exitCode: Number,
    durationMs: Number,
    capturedAt: { type: Date, required: true, index: true },
    classification: {
      type: String,
      enum: ['normal', 'error', 'install', 'git', 'deploy', 'test', 'secret-risk'],
      default: 'normal',
      index: true,
    },
  })
);

module.exports = {
  Artifact,
  SnippetArtifact,
  MarkdownArtifact,
  CanvasArtifact,
  CredentialArtifact,
  RemoteConnectionArtifact,
  TerminalEventArtifact,
};
