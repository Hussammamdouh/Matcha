const cloudinaryProvider = require('./providers/cloudinary');
const firebaseProvider = require('./providers/firebase');

function getProvider() {
  const providerName = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();
  if (providerName === 'cloudinary') return cloudinaryProvider;
  return firebaseProvider;
}

module.exports = {
  getProvider,
};


