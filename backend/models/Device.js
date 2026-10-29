const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    app: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true, index: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    deviceId: { type: String, default: '' },
    externalUserId: { type: String, default: '', index: true },
    appVersion: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    model: { type: String, default: '' },
    locale: { type: String, default: '' },
    timezone: { type: String, default: '' },
    tags: { type: [String], default: [], index: true },
    active: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

deviceSchema.index({ app: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('Device', deviceSchema);
