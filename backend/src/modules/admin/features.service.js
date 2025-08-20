const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const features = require('../../config/features');

// Remove top-level Firebase initialization
// const db = getFirestore();
const logger = createModuleLogger('admin:features:service');

/**
 * Get Firestore instance (lazy-loaded)
 * @returns {Object} Firestore instance
 */
function getDb() {
  return getFirestore();
}

/**
 * Safe features that can be toggled via admin API
 * These are non-secret, non-critical features
 */
const ADMIN_SAFE_FEATURES = [
  'chatAudio',
  'chatRealtimeWs',
  'chatTyping',
  'chatPresence',
  'chatModeration',
  'chatPush',
  'menFlags',
  'menModeration',
  'menTakedowns',
  'searchEnabled',
  'notificationsEnabled',
  'analyticsEnabled',
];

/**
 * Get current feature flags
 * @returns {Promise<Object>} Current features
 */
async function getFeatures() {
  try {
    const db = getDb();
    
    // Get features from Firestore if they exist
    const featuresDoc = await db.collection('system').doc('features').get();
    
    if (featuresDoc.exists) {
      const storedFeatures = featuresDoc.data();
      logger.info('Features retrieved from Firestore', {
        count: Object.keys(storedFeatures).length,
      });
      return storedFeatures;
    }
    
    // Fall back to config file
    logger.info('Features retrieved from config file', {
      count: Object.keys(features).length,
    });
    return features;
  } catch (error) {
    logger.error('Failed to get features', {
      error: error.message,
    });
    // Fall back to config file on error
    return features;
  }
}

/**
 * Update feature flags
 * @param {Object} updates - Feature updates
 * @param {string} actorUserId - ID of the user updating features
 * @returns {Promise<Object>} Updated features
 */
async function updateFeatures(updates, actorUserId) {
  try {
    const db = getDb();
    
    // Validate updates
    const validationResult = validateFeatureUpdates(updates);
    if (!validationResult.isValid) {
      throw new Error(`Invalid feature updates: ${validationResult.errors.join(', ')}`);
    }
    
    // Get current features
    const currentFeatures = await getFeatures();
    
    // Apply updates
    const updatedFeatures = { ...currentFeatures };
    for (const [key, value] of Object.entries(updates)) {
      if (ADMIN_SAFE_FEATURES.includes(key)) {
        updatedFeatures[key] = value;
      } else {
        logger.warn('Attempted to update unsafe feature', {
          feature: key,
          actorUserId,
        });
      }
    }
    
    // Store in Firestore
    await db.collection('system').doc('features').set(updatedFeatures, { merge: true });
    
    logger.info('Features updated', {
      updates: Object.keys(updates),
      actorUserId,
    });
    
    return updatedFeatures;
  } catch (error) {
    logger.error('Failed to update features', {
      error: error.message,
      updates,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Check if a specific feature is enabled
 * @param {string} featureName - Feature name
 * @returns {Promise<boolean>} Whether feature is enabled
 */
async function isFeatureEnabled(featureName) {
  try {
    const currentFeatures = await getFeatures();
    return currentFeatures[featureName] === true;
  } catch (error) {
    logger.error('Failed to check feature status', {
      error: error.message,
      featureName,
    });
    // Default to disabled on error
    return false;
  }
}

/**
 * Validate feature updates
 * @param {Object} updates - Feature updates to validate
 * @returns {Object} Validation result
 */
function validateFeatureUpdates(updates) {
  const errors = [];
  
  if (!updates || typeof updates !== 'object') {
    errors.push('Updates must be an object');
    return { isValid: false, errors };
  }
  
  for (const [key, value] of Object.entries(updates)) {
    // Check if feature is safe to update
    if (!ADMIN_SAFE_FEATURES.includes(key)) {
      errors.push(`Feature '${key}' is not safe to update via API`);
      continue;
    }
    
    // Check if value is boolean
    if (typeof value !== 'boolean') {
      errors.push(`Feature '${key}' value must be boolean, got ${typeof value}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get feature metadata (description, category, etc.)
 * @returns {Object} Feature metadata
 */
function getFeatureMetadata() {
  try {
    const metadata = {
      kyc: {
        description: 'Know Your Customer verification system',
        category: 'verification',
        safe: true,
      },
      phoneAuth: {
        description: 'Phone authentication (OTP + SMS MFA)',
        category: 'authentication',
        safe: true,
      },
      recaptcha: {
        description: 'reCAPTCHA Enterprise integration',
        category: 'security',
        safe: true,
      },
      voicePosts: {
        description: 'Voice posts (audio content)',
        category: 'content',
        safe: true,
      },
      shadowban: {
        description: 'Shadowban system for abusive users',
        category: 'moderation',
        safe: true,
      },
      chatAudio: {
        description: 'Audio messages in chat',
        category: 'chat',
        safe: true,
      },
      chatRealtimeWs: {
        description: 'Real-time WebSocket chat',
        category: 'chat',
        safe: true,
      },
      chatTyping: {
        description: 'Typing indicators in chat',
        category: 'chat',
        safe: true,
      },
      chatPresence: {
        description: 'User presence in chat',
        category: 'chat',
        safe: true,
      },
      chatModeration: {
        description: 'Chat moderation tools',
        category: 'moderation',
        safe: true,
      },
      chatPush: {
        description: 'Push notifications for chat',
        category: 'notifications',
        safe: true,
      },
    };
    
    return metadata;
  } catch (error) {
    logger.error('Failed to get feature metadata', {
      error: error.message,
    });
    return {};
  }
}

/**
 * Get feature change history (stub - would integrate with audit system)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Feature change history
 */
async function getFeatureHistory(options = {}) {
  try {
    // This is a stub implementation
    // In a real system, you would query an audit log or change history table
    
    const { limit = 20, cursor } = options;
    
    // Mock data for demonstration
    const history = [
      {
        id: '1',
        feature: 'chatModeration',
        oldValue: false,
        newValue: true,
        changedBy: 'admin_user_123',
        changedAt: new Date(Date.now() - 86400000), // 1 day ago
        reason: 'Enable chat moderation for safety',
      },
      {
        id: '2',
        feature: 'voicePosts',
        oldValue: true,
        newValue: false,
        changedBy: 'admin_user_456',
        changedAt: new Date(Date.now() - 172800000), // 2 days ago
        reason: 'Temporarily disable due to abuse',
      },
    ];
    
    logger.debug('Feature history retrieved', {
      count: history.length,
      options,
    });
    
    return {
      data: history,
      meta: {
        count: history.length,
        hasMore: false,
        nextCursor: null,
        limit,
      },
    };
  } catch (error) {
    logger.error('Failed to get feature history', {
      error: error.message,
      options,
    });
    throw error;
  }
}

module.exports = {
  getFeatures,
  updateFeatures,
  isFeatureEnabled,
  getFeatureMetadata,
  validateFeatureUpdates,
  getFeatureHistory,
  ADMIN_SAFE_FEATURES,
};
