const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  responseStatus: { type: Number },
  responseBody: { type: mongoose.Schema.Types.Mixed },
  latencyMs: { type: Number },
  error: { type: String }
}, { _id: false });

const webhookLogSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  method: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed
  },
  queryParams: {
    type: mongoose.Schema.Types.Mixed
  },
  body: {
    type: mongoose.Schema.Types.Mixed
  },
  responseStatus: {
    type: Number,
    index: true
  },
  responseHeaders: {
    type: mongoose.Schema.Types.Mixed
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed
  },
  latencyMs: {
    type: Number
  },
  deliveryStatus: {
    type: String,
    enum: ['success', 'failed', 'retrying'],
    required: true,
    index: true
  },
  attempts: [attemptSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
