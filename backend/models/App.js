const mongoose = require('mongoose');
const crypto = require('crypto');

const appSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    packageName: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['android', 'ios', 'both'], default: 'android' },
    description: { type: String, default: '' },
    iconUrl: { type: String, default: '' },
    playStoreUrl: { type: String, default: '' },
    // Key the mobile app uses to register device tokens with this portal.
    sdkApiKey: { type: String, unique: true, index: true },
    // Firebase service account. privateKey is stored AES-256-GCM encrypted.
    fcm: {
      projectId: { type: String, default: '' },
      clientEmail: { type: String, default: '' },
      privateKeyEncrypted: { type: String, default: '' },
      configuredAt: { type: Date },
    },
    // Optional default context for the AI composer.
    aiContext: {
      audience: { type: String, default: '' },
      tone: { type: String, default: 'friendly' },
      brandVoice: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

appSchema.index({ owner: 1, packageName: 1 }, { unique: true });

appSchema.statics.generateSdkKey = function generateSdkKey() {
  return `ad_${crypto.randomBytes(24).toString('hex')}`;
};

appSchema.pre('validate', function assignKey() {
  if (!this.sdkApiKey) this.sdkApiKey = this.constructor.generateSdkKey();
});

appSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this._id,
    name: this.name,
    packageName: this.packageName,
    platform: this.platform,
    description: this.description,
    iconUrl: this.iconUrl,
    playStoreUrl: this.playStoreUrl,
    sdkApiKey: this.sdkApiKey,
    fcm: {
      configured: Boolean(this.fcm?.privateKeyEncrypted),
      projectId: this.fcm?.projectId || '',
      clientEmail: this.fcm?.clientEmail || '',
      configuredAt: this.fcm?.configuredAt || null,
    },
    aiContext: this.aiContext,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('App', appSchema);
