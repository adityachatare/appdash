const Notification = require('../models/Notification');
const { dispatchNotification, resolveTargetTokens, sendToTokens, getFirebaseApp } = require('../services/fcm');

function parseTarget(input = {}) {
  const target = { type: input.type || 'all' };
  if (target.type === 'tags') target.tags = (input.tags || []).map(String).filter(Boolean);
  if (target.type === 'platform') target.platform = input.platform || '';
  if (target.type === 'tokens') target.tokens = (input.tokens || []).map(String).filter(Boolean);
  if (target.type === 'users') target.externalUserIds = (input.externalUserIds || []).map(String).filter(Boolean);
  return target;
}

function parseData(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(input)) if (k && v !== undefined && v !== null) out[k] = String(v);
  return out;
}

function buildDoc(req) {
  const b = req.body || {};
  if (!b.title || !b.body) {
    const err = new Error('title and body are required');
    err.status = 400;
    throw err;
  }
  return {
    app: req.ownedApp._id,
    createdBy: req.user._id,
    title: String(b.title).slice(0, 100),
    body: String(b.body).slice(0, 500),
    imageUrl: b.imageUrl || '',
    deepLink: b.deepLink || '',
    data: parseData(b.data),
    target: parseTarget(b.target),
    ai: {
      generated: Boolean(b.ai?.generated),
      prompt: b.ai?.prompt || '',
      model: b.ai?.model || '',
    },
  };
}

async function list(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const query = { app: req.ownedApp._id };
  if (status) query.status = status;
  const pageNum = Math.max(1, Number(page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
  const [items, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    Notification.countDocuments(query),
  ]);
  res.json({ notifications: items, total, page: pageNum, pages: Math.ceil(total / perPage) });
}

async function get(req, res) {
  const n = await Notification.findOne({ _id: req.params.notificationId, app: req.ownedApp._id }).lean();
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification: n });
}

/**
 * Creates a notification. `mode` decides what happens next:
 *  - "send"     : dispatch immediately
 *  - "schedule" : queue for `scheduledAt`
 *  - "draft"    : save only (default)
 */
async function create(req, res) {
  const doc = buildDoc(req);
  const mode = req.body?.mode || 'draft';

  if (mode === 'schedule') {
    const when = new Date(req.body?.scheduledAt);
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'scheduledAt must be a valid date' });
    if (when.getTime() < Date.now() - 60 * 1000) return res.status(400).json({ error: 'scheduledAt is in the past' });
    doc.status = 'scheduled';
    doc.scheduledAt = when;
  }

  const notification = await Notification.create(doc);

  if (mode === 'send') {
    if (!req.ownedApp.fcm?.privateKeyEncrypted) {
      notification.status = 'failed';
      notification.error = 'Firebase service account is not configured for this app';
      await notification.save();
      return res.status(400).json({ error: notification.error, notification });
    }
    await dispatchNotification(req.ownedApp, notification);
    return res.status(201).json({ notification });
  }

  res.status(201).json({ notification });
}

/** Edit a draft or scheduled notification. */
async function update(req, res) {
  const n = await Notification.findOne({ _id: req.params.notificationId, app: req.ownedApp._id });
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  if (!['draft', 'scheduled'].includes(n.status)) {
    return res.status(409).json({ error: `Cannot edit a notification with status "${n.status}"` });
  }
  const doc = buildDoc(req);
  delete doc.app;
  delete doc.createdBy;
  Object.assign(n, doc);
  if (req.body?.scheduledAt !== undefined) {
    if (req.body.scheduledAt) {
      const when = new Date(req.body.scheduledAt);
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'scheduledAt must be a valid date' });
      n.scheduledAt = when;
      n.status = 'scheduled';
    } else {
      n.scheduledAt = undefined;
      n.status = 'draft';
    }
  }
  await n.save();
  res.json({ notification: n });
}

/** Send a draft / scheduled notification now. */
async function sendNow(req, res) {
  const n = await Notification.findOne({ _id: req.params.notificationId, app: req.ownedApp._id });
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  if (!['draft', 'scheduled', 'failed'].includes(n.status)) {
    return res.status(409).json({ error: `Notification already ${n.status}` });
  }
  if (!req.ownedApp.fcm?.privateKeyEncrypted) {
    return res.status(400).json({ error: 'Firebase service account is not configured for this app' });
  }
  n.scheduledAt = undefined;
  await dispatchNotification(req.ownedApp, n);
  res.json({ notification: n });
}

async function cancel(req, res) {
  const n = await Notification.findOne({ _id: req.params.notificationId, app: req.ownedApp._id });
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  if (n.status !== 'scheduled') return res.status(409).json({ error: 'Only scheduled notifications can be cancelled' });
  n.status = 'cancelled';
  await n.save();
  res.json({ notification: n });
}

async function remove(req, res) {
  const result = await Notification.deleteOne({
    _id: req.params.notificationId,
    app: req.ownedApp._id,
    status: { $nin: ['sending'] },
  });
  if (!result.deletedCount) return res.status(404).json({ error: 'Notification not found or currently sending' });
  res.status(204).end();
}

/** Re-use a sent notification as the basis of a new draft. */
async function duplicate(req, res) {
  const src = await Notification.findOne({ _id: req.params.notificationId, app: req.ownedApp._id }).lean();
  if (!src) return res.status(404).json({ error: 'Notification not found' });
  const copy = await Notification.create({
    app: src.app,
    createdBy: req.user._id,
    title: src.title,
    body: src.body,
    imageUrl: src.imageUrl,
    deepLink: src.deepLink,
    data: src.data,
    target: src.target,
    ai: src.ai,
    status: 'draft',
  });
  res.status(201).json({ notification: copy });
}

/** Preview how many devices a target would reach. */
async function estimate(req, res) {
  const tokens = await resolveTargetTokens(req.ownedApp._id, parseTarget(req.body?.target));
  res.json({ reach: tokens.length });
}

/** Send a one-off test message to specific tokens without creating a campaign record. */
async function sendTest(req, res) {
  const { title, body, imageUrl = '', deepLink = '', data = {}, tokens = [] } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  if (!tokens.length) return res.status(400).json({ error: 'At least one device token is required' });
  if (!req.ownedApp.fcm?.privateKeyEncrypted) {
    return res.status(400).json({ error: 'Firebase service account is not configured for this app' });
  }
  const firebaseApp = getFirebaseApp(req.ownedApp);
  const result = await sendToTokens(
    firebaseApp,
    { title, body, imageUrl, deepLink, data: parseData(data), _id: 'test' },
    tokens.map(String)
  );
  res.json({ success: result.success, failure: result.failure, errors: result.errors, invalidTokens: result.invalidTokens });
}

module.exports = { list, get, create, update, sendNow, cancel, remove, duplicate, estimate, sendTest };
