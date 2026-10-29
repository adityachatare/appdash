const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await User.findOne({ email: String(email).toLowerCase() });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signToken(user), user: user.toSafeJSON() });
}

async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

module.exports = { register, login, me };
