const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = { connectDb };
