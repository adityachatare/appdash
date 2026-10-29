const jwt = require('jsonwebtoken');
const User = require('../models/User');
const App = require('../models/App');
const { env } = require('../config/env');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Loads req.ownedApp for /apps/:appId routes and checks the caller owns it. */
async function loadOwnedApp(req, res, next) {
  try {
    const app = await App.findOne({ _id: req.params.appId, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });
    req.ownedApp = app;
    next();
  } catch {
    return res.status(404).json({ error: 'App not found' });
  }
}

/** Authenticates mobile SDK calls via the per-app key in the x-api-key header. */
async function requireSdkKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'x-api-key header required' });
  const app = await App.findOne({ sdkApiKey: key });
  if (!app) return res.status(401).json({ error: 'Invalid API key' });
  req.ownedApp = app;
  next();
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

module.exports = { requireAuth, loadOwnedApp, requireSdkKey, signToken };
