'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { EncryptedEnvelopeSchema } = require('./encryptedEnvelope');

const ArtifactVersionSchema = new Schema(
  {
    artifactId: {
      type: Schema.Types.ObjectId,
      ref: 'Artifact',
      required: true,
      index: true,
    },
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

    version: { type: Number, required: true },
    parentVersion: { type: Number },

    contentHash: { type: String, required: true },
    diffHash: { type: String },

    // Plain snapshot for non-sensitive artifacts
    snapshotText: String,
    // Encrypted snapshot for E2E artifacts
    snapshotEnvelope: EncryptedEnvelopeSchema,

    patch: {
      format: {
        type: String,
        enum: ['json-patch', 'unified-diff', 'binary-delta', 'full'],
        default: 'full',
      },
      text: String,
      envelope: EncryptedEnvelopeSchema,
    },

    source: {
      type: {
        type: String,
        enum: ['manual', 'cli', 'remote-pre-save', 'remote-post-save', 'sync'],
        required: true,
      },
      deviceId: { type: Schema.Types.ObjectId, ref: 'Device' },
      remoteConnectionId: { type: Schema.Types.ObjectId },
      remotePath: String,
    },

    changeNote: { type: String, trim: true },
  },
  { timestamps: true }
);

ArtifactVersionSchema.index({ artifactId: 1, version: -1 }, { unique: true });

module.exports = mongoose.model('ArtifactVersion', ArtifactVersionSchema);
