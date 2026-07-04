'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { EncryptedEnvelopeSchema } = require('./encryptedEnvelope');

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, trim: true },

    // Argon2id hashed password — never store reversible
    passwordHash: { type: String },

    // Encrypted account root key, wrapped by passphrase-derived KEK
    encryptedAccountRootKey: EncryptedEnvelopeSchema,

    plan: {
      type: String,
      enum: ['free', 'pro', 'team', 'enterprise'],
      default: 'free',
    },

    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },

    // Refresh token rotation
    refreshTokenHash: { type: String },
    refreshTokenFamily: { type: String },
  },
  { timestamps: true }
);


// Never expose sensitive fields
UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    email: this.email,
    displayName: this.displayName,
    plan: this.plan,
    isVerified: this.isVerified,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
