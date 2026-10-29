const { initializeApp, deleteApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const Device = require('../models/Device');
const { decrypt } = require('./crypto');

// One firebase-admin App instance per portal App, keyed by app id + credential version.
const instances = new Map();

function buildCredential(appDoc) {
  if (!appDoc.fcm?.privateKeyEncrypted) {
    const err = new Error('Firebase service account is not configured for this app');
    err.status = 400;
    throw err;
  }
  return cert({
    projectId: appDoc.fcm.projectId,
    clientEmail: appDoc.fcm.clientEmail,
    privateKey: decrypt(appDoc.fcm.privateKeyEncrypted),
  });
}

function getFirebaseApp(appDoc) {
  const cacheKey = `${appDoc._id}:${appDoc.fcm?.configuredAt ? new Date(appDoc.fcm.configuredAt).getTime() : 0}`;
  if (instances.has(cacheKey)) return instances.get(cacheKey);

  // Drop stale instances for this app (credentials were rotated).
  for (const [k, inst] of instances) {
    if (k.startsWith(`${appDoc._id}:`)) {
      deleteApp(inst).catch(() => {});
      instances.delete(k);
    }
  }

  const instance = initializeApp({ credential: buildCredential(appDoc) }, cacheKey);
  instances.set(cacheKey, instance);
  return instance;
}

function buildMessage(notification) {
  const data = {};
  if (notification.data) {
    const entries = notification.data instanceof Map ? notification.data.entries() : Object.entries(notification.data);
    for (const [k, v] of entries) data[k] = String(v);
  }
  if (notification.deepLink) data.deepLink = notification.deepLink;
  data.notificationId = String(notification._id || '');

  const msg = {
    notification: { title: notification.title, body: notification.body },
    data,
    android: {
      priority: 'high',
      notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
    },
    apns: { payload: { aps: { sound: 'default', 'mutable-content': 1 } } },
  };
  if (notification.imageUrl) {
    msg.notification.imageUrl = notification.imageUrl;
    msg.android.notification.imageUrl = notification.imageUrl;
    msg.apns.fcmOptions = { imageUrl: notification.imageUrl };
  }
  return msg;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Sends `notification` to `tokens` in batches of 500 using the given firebase app.
 * Returns aggregate counts and the list of tokens FCM reported as invalid.
 */
async function sendToTokens(firebaseApp, notification, tokens) {
  const messaging = getMessaging(firebaseApp);
  const base = buildMessage(notification);
  const result = { success: 0, failure: 0, invalidTokens: [], errors: {} };

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({ ...base, tokens: batch });
    result.success += res.successCount;
    result.failure += res.failureCount;
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error?.code || 'unknown';
      result.errors[code] = (result.errors[code] || 0) + 1;
      if (INVALID_TOKEN_CODES.has(code)) result.invalidTokens.push(batch[idx]);
    });
  }
  return result;
}

/** Resolves the device tokens a notification's target selects. */
async function resolveTargetTokens(appId, target) {
  const query = { app: appId, active: true };
  switch (target?.type) {
    case 'tags':
      if (target.tags?.length) query.tags = { $in: target.tags };
      break;
    case 'platform':
      if (target.platform) query.platform = target.platform;
      break;
    case 'users':
      query.externalUserId = { $in: target.externalUserIds || [] };
      break;
    case 'tokens':
      return [...new Set(target.tokens || [])];
    default:
      break;
  }
  const docs = await Device.find(query).select('token').lean();
  return docs.map((d) => d.token);
}

function summarizeErrors(errors) {
  return Object.entries(errors)
    .map(([c, n]) => `${c} x${n}`)
    .join(', ');
}

/** Full send pipeline for a persisted Notification document. */
async function dispatchNotification(appDoc, notification) {
  notification.status = 'sending';
  await notification.save();

  try {
    const firebaseApp = getFirebaseApp(appDoc);
    const tokens = await resolveTargetTokens(appDoc._id, notification.target);
    notification.stats.targeted = tokens.length;

    if (tokens.length === 0) {
      notification.status = 'failed';
      notification.error = 'No active devices matched the target';
      await notification.save();
      return notification;
    }

    const result = await sendToTokens(firebaseApp, notification, tokens);
    notification.stats.success = result.success;
    notification.stats.failure = result.failure;

    if (result.invalidTokens.length) {
      const upd = await Device.updateMany(
        { app: appDoc._id, token: { $in: result.invalidTokens } },
        { $set: { active: false } }
      );
      notification.stats.invalidTokensRemoved = upd.modifiedCount || 0;
    }

    notification.sentAt = new Date();
    if (result.success === 0) {
      notification.status = 'failed';
      notification.error = summarizeErrors(result.errors);
    } else if (result.failure > 0) {
      notification.status = 'partial';
      notification.error = summarizeErrors(result.errors);
    } else {
      notification.status = 'sent';
      notification.error = '';
    }
  } catch (err) {
    notification.status = 'failed';
    notification.error = err.message;
  }
  await notification.save();
  return notification;
}

/** Validates a service account by requesting an access token from Google. */
async function verifyCredentials(appDoc) {
  await buildCredential(appDoc).getAccessToken();
  return true;
}

module.exports = { dispatchNotification, sendToTokens, resolveTargetTokens, getFirebaseApp, verifyCredentials, buildMessage };
