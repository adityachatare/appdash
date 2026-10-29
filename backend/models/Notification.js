const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['all', 'tags', 'platform', 'tokens', 'users'], default: 'all' },
    tags: { type: [String], default: [] },
    platform: { type: String, enum: ['android', 'ios', 'web', ''], default: '' },
    tokens: { type: [String], default: [] },
    externalUserIds: { type: [String], default: [] },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    app: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    data: { type: Map, of: String, default: {} },
    target: { type: targetSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'partial', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    sentAt: { type: Date },
    stats: {
      targeted: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failure: { type: Number, default: 0 },
      invalidTokensRemoved: { type: Number, default: 0 },
    },
    error: { type: String, default: '' },
    ai: {
      generated: { type: Boolean, default: false },
      prompt: { type: String, default: '' },
      model: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
