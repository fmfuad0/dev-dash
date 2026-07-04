'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspaceSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-]+$/,
    },

    description: { type: String, trim: true },
    color: { type: String, default: '#6366f1' }, // for UI accent

    git: {
      remoteUrlHash: { type: String, index: true },
      defaultBranch: { type: String },
      repoRootHint: { type: String },
    },

    privacyMode: {
      type: String,
      enum: ['standard', 'e2e', 'local-only'],
      default: 'standard',
      index: true,
    },

    settings: {
      vectorSearchEnabled: { type: Boolean, default: false },
      cloudAstIndexingEnabled: { type: Boolean, default: true },
      remoteConnectorMode: {
        type: String,
        enum: ['local-daemon-only', 'ephemeral-cloud-allowed'],
        default: 'local-daemon-only',
      },
    },

    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WorkspaceSchema.index({ ownerId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Workspace', WorkspaceSchema);
