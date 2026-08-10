const mongoose = require('mongoose');

const vsCodeStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  stateData: {
    type: String, // We'll store the exported IndexedDB JSON as a string
    default: '{}'
  }
}, { timestamps: true });

module.exports = mongoose.model('VsCodeState', vsCodeStateSchema);
