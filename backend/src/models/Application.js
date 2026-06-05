const mongoose = require('mongoose');

const headerSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  value: { type: String, required: true }
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  appType: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-_]+$/, 'appType must contain only alphanumeric characters, dashes, and underscores']
  },
  targetUrl: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  headers: [headerSchema],
  retryConfig: {
    maxRetries: { type: Number, default: 3, min: 0, max: 10 },
    delaySeconds: { type: Number, default: 5, min: 1, max: 60 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Application', applicationSchema);
