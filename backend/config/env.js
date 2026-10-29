require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];

const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  aiModel: process.env.AI_MODEL || 'claude-opus-5-5',
};

function validateEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.encryptionKey)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
}

module.exports = { env, validateEnv };
