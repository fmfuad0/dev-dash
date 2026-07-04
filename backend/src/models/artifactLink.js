'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArtifactLinkSchema = new Schema(
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

    fromArtifactId: {
      type: Schema.Types.ObjectId,
      ref: 'Artifact',
      required: true,
      index: true,
    },
    toArtifactId: {
      type: Schema.Types.ObjectId,
      ref: 'Artifact',
      required: true,
      index: true,
    },

    relation: {
      type: String,
      enum: [
        'references',
        'explains',
        'generated-from',
        'fixes-error',
        'uses-credential',
        'belongs-to-canvas',
        'similar-to',
      ],
      required: true,
      index: true,
    },

    weight: { type: Number, default: 1 },
    createdBy: {
      type: String,
      enum: ['user', 'system', 'ai'],
      default: 'user',
    },
  },
  { timestamps: true }
);

ArtifactLinkSchema.index(
  { fromArtifactId: 1, toArtifactId: 1, relation: 1 },
  { unique: true }
);
ArtifactLinkSchema.index({ fromArtifactId: 1, relation: 1 });
ArtifactLinkSchema.index({ toArtifactId: 1, relation: 1 });

module.exports = mongoose.model('ArtifactLink', ArtifactLinkSchema);
