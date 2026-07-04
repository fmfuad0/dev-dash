'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Encrypted Envelope Sub-Schema ───────────────────────────────────────────
const EncryptedEnvelopeSchema = new Schema(
  {
    version: { type: Number, required: true, default: 1 },
    alg: { type: String, required: true }, // e.g. "xchacha20poly1305-ietf"
    kdf: {
      name: { type: String },
      params: { type: Schema.Types.Mixed },
      salt: { type: String },
    },
    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
    tag: { type: String },
    aad: { type: String },
    wrappedKeys: [
      {
        recipientType: {
          type: String,
          enum: ['device', 'user', 'team'],
          required: true,
        },
        recipientId: { type: Schema.Types.ObjectId, required: true },
        wrapAlg: { type: String, required: true },
        nonce: { type: String },
        wrappedKey: { type: String, required: true },
      },
    ],
    keyVersion: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

module.exports = { EncryptedEnvelopeSchema };
