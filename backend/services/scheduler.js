const Notification = require('../models/Notification');
const App = require('../models/App');
const { dispatchNotification } = require('./fcm');

const INTERVAL_MS = 30 * 1000;
let timer;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    // Claim one due notification at a time so concurrent ticks never double-send.
    for (;;) {
      const due = await Notification.findOneAndUpdate(
        { status: 'scheduled', scheduledAt: { $lte: new Date() } },
        { $set: { status: 'sending' } },
        { returnDocument: 'after' }
      );
      if (!due) break;
      const app = await App.findById(due.app);
      if (!app) {
        due.status = 'failed';
        due.error = 'App no longer exists';
        await due.save();
        continue;
      }
      console.log(`[scheduler] sending notification ${due._id} for app ${app.name}`);
      await dispatchNotification(app, due);
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err.message);
  } finally {
    running = false;
  }
}

function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  tick();
  console.log('[scheduler] started');
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

module.exports = { startScheduler, stopScheduler, tick };
