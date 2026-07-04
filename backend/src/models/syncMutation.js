'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SyncMutationSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true,
    },

    mutationId: { type: String, required: true, unique: true },
    clientSeq: { type: Number, required: true },
    serverSeq: { type: Number, index: true },

    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },

    op: {
      type: String,
      enum: [
        'artifact.create',
        'artifact.update',
        'artifact.delete',
        'artifact.link',
        'vault.upsert',
        'canvas.crdtUpdate',
        'remote.snapshot',
        'terminal.capture',
      ],
      required: true,
    },

    payload: { type: Schema.Types.Mixed, required: true },

    status: {
      type: String,
      enum: ['accepted', 'rejected', 'applied', 'conflict'],
      default: 'accepted',
      index: true,
    },

    error: {
      code: String,
      message: String,
    },

    // Hybrid Logical Clock for ordering
    hybridLogicalClock: { type: String, required: true, index: true },

    // Ed25519 signature of payload
    signature: { type: String },
  },
  { timestamps: true }
);

SyncMutationSchema.index({ ownerId: 1, deviceId: 1, clientSeq: 1 }, { unique: true });
SyncMutationSchema.index({ ownerId: 1, serverSeq: 1 });

module.exports = mongoose.model('SyncMutation', SyncMutationSchema);
