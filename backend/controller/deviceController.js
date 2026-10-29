const Device = require('../models/Device');

/** Dashboard: list devices for an owned app with search, filter and pagination. */
async function list(req, res) {
  const { page = 1, limit = 25, platform, tag, active, q } = req.query;
  const query = { app: req.ownedApp._id };
  if (platform) query.platform = platform;
  if (tag) query.tags = tag;
  if (active === 'true') query.active = true;
  if (active === 'false') query.active = false;
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ externalUserId: re }, { deviceId: re }, { model: re }, { token: re }];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(limit) || 25));
  const [items, total] = await Promise.all([
    Device.find(query).sort({ lastSeenAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    Device.countDocuments(query),
  ]);
  res.json({ devices: items, total, page: pageNum, pages: Math.ceil(total / perPage) });
}

async function remove(req, res) {
  const result = await Device.deleteOne({ _id: req.params.deviceId, app: req.ownedApp._id });
  if (!result.deletedCount) return res.status(404).json({ error: 'Device not found' });
  res.status(204).end();
}

/** Dashboard helper for testing without a real mobile app: register a token by hand. */
async function addManual(req, res) {
  const { token, platform = 'android', tags = [], externalUserId = '' } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  const device = await Device.findOneAndUpdate(
    { app: req.ownedApp._id, token },
    { $set: { platform, tags, externalUserId, active: true, lastSeenAt: new Date(), model: 'manual' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.status(201).json({ device });
}

/* ---------- Public SDK endpoints (authenticated by x-api-key) ---------- */

/** Mobile app calls this on launch / token refresh. Idempotent upsert. */
async function sdkRegister(req, res) {
  const {
    token,
    platform = 'android',
    deviceId = '',
    externalUserId = '',
    appVersion = '',
    osVersion = '',
    model = '',
    locale = '',
    timezone = '',
    tags = [],
  } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const device = await Device.findOneAndUpdate(
    { app: req.ownedApp._id, token },
    {
      $set: {
        platform,
        deviceId,
        externalUserId,
        appVersion,
        osVersion,
        model,
        locale,
        timezone,
        tags: Array.isArray(tags) ? tags.map(String) : [],
        active: true,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.json({ ok: true, deviceId: device._id });
}

/** Mobile app calls this on logout / notification opt-out. */
async function sdkUnregister(req, res) {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  await Device.updateOne({ app: req.ownedApp._id, token }, { $set: { active: false } });
  res.json({ ok: true });
}

/** Mobile app can add/remove segmentation tags for a token. */
async function sdkUpdateTags(req, res) {
  const { token, add = [], remove = [] } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  const device = await Device.findOne({ app: req.ownedApp._id, token });
  if (!device) return res.status(404).json({ error: 'Device not registered' });
  const set = new Set(device.tags);
  add.forEach((t) => set.add(String(t)));
  remove.forEach((t) => set.delete(String(t)));
  device.tags = [...set];
  device.lastSeenAt = new Date();
  await device.save();
  res.json({ ok: true, tags: device.tags });
}

module.exports = { list, remove, addManual, sdkRegister, sdkUnregister, sdkUpdateTags };
