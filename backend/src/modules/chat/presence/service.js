const { getFirestore } = require('firebase-admin/firestore');
const { createModuleLogger } = require('../../../lib/logger');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Update user presence
 * @param {string} userId - User ID
 * @param {string} state - Presence state ('online' or 'offline')
 * @returns {Promise<Object>} Updated presence data
 */
async function updatePresence(userId, state) {
  try {
    if (!['online', 'offline'].includes(state)) {
      throw new Error('Invalid presence state');
    }

    const presenceData = {
      state,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('presence').doc(userId).set(presenceData, { merge: true });

    logger.info('User presence updated', {
      userId,
      state,
    });

    return {
      userId,
      ...presenceData,
    };
  } catch (error) {
    logger.error('Failed to update presence', {
      error: error.message,
      userId,
      state,
    });
    throw error;
  }
}

/**
 * Get user presence
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Presence data or null
 */
async function getPresence(userId) {
  try {
    const presenceDoc = await db.collection('presence').doc(userId).get();
    
    if (!presenceDoc.exists) {
      return null;
    }

    return {
      userId,
      ...presenceDoc.data(),
    };
  } catch (error) {
    logger.error('Failed to get presence', {
      error: error.message,
      userId,
    });
    return null;
  }
}

/**
 * Set typing status for a user in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {boolean} isTyping - Typing status
 * @returns {Promise<boolean>} Success status
 */
async function setTypingStatus(conversationId, userId, isTyping) {
  try {
    // Check if user is a participant
    const participantDoc = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .get();

    if (!participantDoc.exists) {
      throw new Error('User is not a participant in this conversation');
    }

    // Update typing status
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .update({
        isTyping: isTyping,
        typingUpdatedAt: new Date(),
      });

    logger.info('Typing status updated', {
      conversationId,
      userId,
      isTyping,
    });

    return true;
  } catch (error) {
    logger.error('Failed to set typing status', {
      error: error.message,
      conversationId,
      userId,
      isTyping,
    });
    throw error;
  }
}

/**
 * Mark conversation as read for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {Date} readAt - Timestamp when read (defaults to now)
 * @returns {Promise<boolean>} Success status
 */
async function markAsRead(conversationId, userId, readAt = null) {
  try {
    // Check if user is a participant
    const participantDoc = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .get();

    if (!participantDoc.exists) {
      throw new Error('User is not a participant in this conversation');
    }

    const timestamp = readAt || new Date();

    // Update last read timestamp
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .update({
        lastReadAt: timestamp,
      });

    logger.info('Conversation marked as read', {
      conversationId,
      userId,
      readAt: timestamp,
    });

    return true;
  } catch (error) {
    logger.error('Failed to mark conversation as read', {
      error: error.message,
      conversationId,
      userId,
      readAt,
    });
    throw error;
  }
}

module.exports = {
  updatePresence,
  getPresence,
  setTypingStatus,
  markAsRead,
};
