const express = require('express');
const cors = require('cors');
const { env, validateEnv } = require('./config/env');
const { connectDb } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errors');
const { startScheduler, stopScheduler } = require('./services/scheduler');

validateEnv();

const app = express();

app.use(cors({ origin: env.clientOrigin.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), aiConfigured: Boolean(env.anthropicApiKey) });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/apps', require('./routes/apps'));
app.use('/api/sdk', require('./routes/sdk'));

app.use(notFound);
app.use(errorHandler);

async function main() {
  await connectDb();
  startScheduler();
  const server = app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });

  const shutdown = () => {
    stopScheduler();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
