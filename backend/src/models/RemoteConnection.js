const mongoose = require('mongoose');

const remoteConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  host: {
    type: String,
    required: true,
    trim: true,
  },
  port: {
    type: Number,
    default: 22,
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    // In a real production app, this should be encrypted at rest in the DB!
    // We store it plainly here for demonstration, or we expect the Vault feature to handle it later.
    default: '',
  },
  privateKey: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Prevent duplicate names per user
remoteConnectionSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RemoteConnection', remoteConnectionSchema);
