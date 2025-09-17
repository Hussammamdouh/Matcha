require('dotenv').config();
const { config } = require('../src/config');

function mask(value) {
  if (!value) return null;
  if (value.length <= 6) return '*'.repeat(value.length);
  return value.slice(0, 3) + '***' + value.slice(-3);
}

console.log(JSON.stringify({
  storageProvider: config.storageProvider || process.env.STORAGE_PROVIDER || 'firebase',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: mask(process.env.CLOUDINARY_API_KEY || ''),
    apiSecret: mask(process.env.CLOUDINARY_API_SECRET || ''),
  }
}, null, 2));


