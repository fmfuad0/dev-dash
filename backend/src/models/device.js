'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DeviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: ['darwin', 'linux', 'win32', 'browser', 'unknown'],
      default: 'unknown',
    },

    // Public keys for E2E encryption and mutation signing
    publicEncryptionKey: { type: String, required: true },
    publicSigningKey: { type: String, required: true },

    trustStatus: {
      type: String,
      enum: ['pending', 'trusted', 'revoked'],
      default: 'pending',
      index: true,
    },

    lastSeenAt: { type: Date },
    daemonVersion: { type: String },

    // Device fingerprint for audit
    fingerprint: { type: String, index: true },
  },
  { timestamps: true }
);

DeviceSchema.index({ userId: 1, trustStatus: 1 });

module.exports = mongoose.model('Device', DeviceSchema);
