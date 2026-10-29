const crypto = require('crypto');
const { env } = require('../config/env');

const ALGO = 'aes-256-gcm';

function key() {
  return Buffer.from(env.encryptionKey, 'hex');
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.');
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
