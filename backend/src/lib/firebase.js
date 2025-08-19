const admin = require('firebase-admin');
const { config, validateConfig } = require('../config');
const { createLogger } = require('./logger');

const logger = createLogger();

/**
 * Initialize Firebase Admin SDK
 * @returns {Object} Firebase services object
 */
function initializeFirebase() {
  try {
    // Validate configuration before initialization
    validateConfig();

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: config.firebase.projectId,
        storageBucket: `${config.firebase.projectId}.appspot.com`,
      });

      logger.info('Firebase Admin SDK initialized successfully', {
        projectId: config.firebase.projectId,
        storageBucket: `${config.firebase.projectId}.appspot.com`,
      });
    }

    // Get Firebase services
    const firestore = admin.firestore();
    const storage = admin.storage();
    const auth = admin.auth();

    // Configure Firestore settings
    firestore.settings({
      ignoreUndefinedProperties: true,
      // Enable offline persistence for development
      ...(config.isDevelopment && { experimentalForceLongPolling: true }),
    });

    // Configure Storage settings
    const bucket = storage.bucket();

    return {
      admin,
      firestore,
      storage,
      bucket,
      auth,
    };
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get Firestore instance
 * @returns {admin.firestore.Firestore} Firestore instance
 */
function getFirestore() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebase() first.');
  }
  return admin.firestore();
}

/**
 * Get Storage instance
 * @returns {admin.storage.Storage} Storage instance
 */
function getStorage() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebase() first.');
  }
  return admin.storage();
}

/**
 * Get Auth instance
 * @returns {admin.auth.Auth} Auth instance
 */
function getAuth() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebase() first.');
  }
  return admin.auth();
}

/**
 * Get Storage bucket
 * @returns {admin.storage.Bucket} Storage bucket
 */
function getBucket() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebase() first.');
  }
  return admin.storage().bucket();
}

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<admin.auth.DecodedIdToken>} Decoded token
 */
async function verifyIdToken(idToken) {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken, true);
    
    logger.debug('ID token verified successfully', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    });

    return decodedToken;
  } catch (error) {
    logger.warn('ID token verification failed', {
      error: error.message,
      code: error.code,
    });
    throw error;
  }
}

/**
 * Get user custom claims
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Custom claims
 */
async function getUserCustomClaims(uid) {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord.customClaims || {};
  } catch (error) {
    logger.error('Failed to get user custom claims', {
      uid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Set user custom claims
 * @param {string} uid - User ID
 * @param {Object} claims - Custom claims to set
 * @returns {Promise<void>}
 */
async function setUserCustomClaims(uid, claims) {
  try {
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, claims);
    
    logger.info('User custom claims updated', {
      uid,
      claims: { ...claims, password: '[REDACTED]' }, // Redact sensitive data
    });
  } catch (error) {
    logger.error('Failed to set user custom claims', {
      uid,
      claims: { ...claims, password: '[REDACTED]' },
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create custom token for user
 * @param {string} uid - User ID
 * @param {Object} additionalClaims - Additional claims to include
 * @returns {Promise<string>} Custom token
 */
async function createCustomToken(uid, additionalClaims = {}) {
  try {
    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    
    logger.debug('Custom token created', {
      uid,
      hasAdditionalClaims: Object.keys(additionalClaims).length > 0,
    });

    return customToken;
  } catch (error) {
    logger.error('Failed to create custom token', {
      uid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Revoke refresh tokens for user
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
async function revokeRefreshTokens(uid) {
  try {
    const auth = getAuth();
    await auth.revokeRefreshTokens(uid);
    
    logger.info('Refresh tokens revoked for user', { uid });
  } catch (error) {
    logger.error('Failed to revoke refresh tokens', {
      uid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get user sessions (Firebase doesn't provide direct session listing)
 * This is a placeholder for future implementation
 * @param {string} uid - User ID
 * @returns {Promise<Array>} User sessions
 */
async function getUserSessions(uid) {
  // TODO: Implement session tracking via Firestore
  // Firebase Auth doesn't provide direct session listing
  // We'll need to track sessions in Firestore when tokens are created/used
  logger.warn('getUserSessions not implemented - Firebase limitation');
  return [];
}

/**
 * Cleanup Firebase resources (for testing)
 */
function cleanup() {
  if (admin.apps.length) {
    admin.apps.forEach(app => app.delete());
    logger.info('Firebase Admin SDK cleaned up');
  }
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getStorage,
  getAuth,
  getBucket,
  verifyIdToken,
  getUserCustomClaims,
  setUserCustomClaims,
  createCustomToken,
  revokeRefreshTokens,
  getUserSessions,
  cleanup,
};
