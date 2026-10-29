const App = require('../models/App');
const Device = require('../models/Device');
const Notification = require('../models/Notification');
const { encrypt } = require('../services/crypto');
const { verifyCredentials } = require('../services/fcm');

const EDITABLE = ['name', 'packageName', 'platform', 'description', 'iconUrl', 'playStoreUrl', 'aiContext'];

function pick(body, keys) {
  const out = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

async function withStats(appDoc) {
  const [devices, activeDevices, notifications, lastSent] = await Promise.all([
    Device.countDocuments({ app: appDoc._id }),
    Device.countDocuments({ app: appDoc._id, active: true }),
    Notification.countDocuments({ app: appDoc._id }),
    Notification.findOne({ app: appDoc._id, sentAt: { $ne: null } }).sort({ sentAt: -1 }).select('sentAt').lean(),
  ]);
  return { ...appDoc.toClientJSON(), stats: { devices, activeDevices, notifications, lastSentAt: lastSent?.sentAt || null } };
}

async function list(req, res) {
  const apps = await App.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ apps: await Promise.all(apps.map(withStats)) });
}

async function create(req, res) {
  const data = pick(req.body || {}, EDITABLE);
  if (!data.name || !data.packageName) return res.status(400).json({ error: 'name and packageName are required' });
  const app = await App.create({ ...data, owner: req.user._id });
  res.status(201).json({ app: await withStats(app) });
}

async function get(req, res) {
  res.json({ app: await withStats(req.ownedApp) });
}

async function update(req, res) {
  Object.assign(req.ownedApp, pick(req.body || {}, EDITABLE));
  await req.ownedApp.save();
  res.json({ app: await withStats(req.ownedApp) });
}

async function remove(req, res) {
  await Promise.all([
    Device.deleteMany({ app: req.ownedApp._id }),
    Notification.deleteMany({ app: req.ownedApp._id }),
    req.ownedApp.deleteOne(),
  ]);
  res.status(204).end();
}

async function rotateSdkKey(req, res) {
  req.ownedApp.sdkApiKey = App.generateSdkKey();
  await req.ownedApp.save();
  res.json({ sdkApiKey: req.ownedApp.sdkApiKey });
}

/**
 * Accepts a Firebase service-account JSON (either the parsed object in `serviceAccount`
 * or a raw JSON string in `serviceAccountJson`) and stores it encrypted.
 */
async function setFcmCredentials(req, res) {
  let sa = req.body?.serviceAccount;
  if (!sa && req.body?.serviceAccountJson) {
    try {
      sa = JSON.parse(req.body.serviceAccountJson);
    } catch {
      return res.status(400).json({ error: 'serviceAccountJson is not valid JSON' });
    }
  }
  if (!sa || !sa.project_id || !sa.client_email || !sa.private_key) {
    return res.status(400).json({ error: 'Service account must include project_id, client_email and private_key' });
  }

  req.ownedApp.fcm = {
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    privateKeyEncrypted: encrypt(sa.private_key),
    configuredAt: new Date(),
  };

  try {
    await verifyCredentials(req.ownedApp);
  } catch (err) {
    return res.status(400).json({ error: `Firebase rejected these credentials: ${err.message}` });
  }

  await req.ownedApp.save();
  res.json({ app: await withStats(req.ownedApp) });
}

async function clearFcmCredentials(req, res) {
  req.ownedApp.fcm = { projectId: '', clientEmail: '', privateKeyEncrypted: '', configuredAt: null };
  await req.ownedApp.save();
  res.json({ app: await withStats(req.ownedApp) });
}

/** Aggregate numbers for the app overview page. */
async function overview(req, res) {
  const appId = req.ownedApp._id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byPlatform, tagCounts, recent, totals, timeline] = await Promise.all([
    Device.aggregate([{ $match: { app: appId, active: true } }, { $group: { _id: '$platform', count: { $sum: 1 } } }]),
    Device.aggregate([
      { $match: { app: appId, active: true } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Notification.find({ app: appId }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.aggregate([
      { $match: { app: appId } },
      {
        $group: {
          _id: null,
          sent: { $sum: '$stats.success' },
          failed: { $sum: '$stats.failure' },
          campaigns: { $sum: 1 },
        },
      },
    ]),
    Notification.aggregate([
      { $match: { app: appId, sentAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
          success: { $sum: '$stats.success' },
          failure: { $sum: '$stats.failure' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    app: await withStats(req.ownedApp),
    devicesByPlatform: Object.fromEntries(byPlatform.map((p) => [p._id, p.count])),
    tags: tagCounts.map((t) => ({ tag: t._id, count: t.count })),
    recentNotifications: recent,
    totals: totals[0] || { sent: 0, failed: 0, campaigns: 0 },
    timeline: timeline.map((t) => ({ date: t._id, success: t.success, failure: t.failure })),
  });
}

module.exports = { list, create, get, update, remove, rotateSdkKey, setFcmCredentials, clearFcmCredentials, overview };
