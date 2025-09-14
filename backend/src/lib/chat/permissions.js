const { getFirestore } = require('../firebase');
const { createModuleLogger } = require('../logger');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Check if user is a participant in a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Participant data or null
 */
async function isParticipant(userId, conversationId) {
  try {
    const participantDoc = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .get();

    if (!participantDoc.exists) {
      return null;
    }

    const participantData = participantDoc.data();
    
    // Check if user is banned
    if (participantData.isBanned) {
      return null;
    }

    return {
      userId,
      conversationId,
      role: participantData.role,
      joinedAt: participantData.joinedAt,
      lastReadAt: participantData.lastReadAt,
      isTyping: participantData.isTyping,
      ...participantData,
    };
  } catch (error) {
    logger.error('Error checking participant status', {
      error: error.message,
      userId,
      conversationId,
    });
    return null;
  }
}

/**
 * Check if user is a moderator or owner in a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} True if moderator/owner
 */
async function isModerator(userId, conversationId) {
  try {
    const participant = await isParticipant(userId, conversationId);
    if (!participant) return false;

    return participant.role === 'moderator' || participant.role === 'owner';
  } catch (error) {
    logger.error('Error checking moderator status', {
      error: error.message,
      userId,
      conversationId,
    });
    return false;
  }
}

/**
 * Check if user is the owner of a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} True if owner
 */
async function isOwner(userId, conversationId) {
  try {
    const participant = await isParticipant(userId, conversationId);
    if (!participant) return false;

    return participant.role === 'owner';
  } catch (error) {
    logger.error('Error checking owner status', {
      error: error.message,
      userId,
      conversationId,
    });
    return false;
  }
}

/**
 * Check if a user is blocked by another user
 * @param {string} userId - User ID
 * @param {string} blockedUserId - Potentially blocked user ID
 * @returns {Promise<boolean>} True if blocked
 */
async function isBlocked(userId, blockedUserId) {
  try {
    const blockDoc = await db
      .collection('blocks')
      .doc(`${userId}_${blockedUserId}`)
      .get();

    return blockDoc.exists;
  } catch (error) {
    logger.error('Error checking block status', {
      error: error.message,
      userId,
      blockedUserId,
    });
    return false;
  }
}

/**
 * Check if conversation is locked (moderators only)
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} True if locked
 */
async function isConversationLocked(conversationId) {
  try {
    const conversationDoc = await db
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) {
      return false;
    }

    return conversationDoc.data().isLocked || false;
  } catch (error) {
    logger.error('Error checking conversation lock status', {
      error: error.message,
      conversationId,
    });
    return false;
  }
}

/**
 * Check if user can send messages in a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Permission check result
 */
async function canSendMessage(userId, conversationId) {
  try {
    // Check if user is participant
    const participant = await isParticipant(userId, conversationId);
    if (!participant) {
      return {
        allowed: false,
        reason: 'NOT_PARTICIPANT',
        message: 'You are not a participant in this conversation',
      };
    }

    // Check if conversation is locked
    const isLocked = await isConversationLocked(conversationId);
    if (isLocked) {
      return {
        allowed: false,
        reason: 'CONVERSATION_LOCKED',
        message: 'This conversation is locked by moderators',
      };
    }

    return {
      allowed: true,
      participant,
    };
  } catch (error) {
    logger.error('Error checking send message permission', {
      error: error.message,
      userId,
      conversationId,
    });
    return {
      allowed: false,
      reason: 'ERROR',
      message: 'Error checking permissions',
    };
  }
}

/**
 * Check if user can edit a message
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} Permission check result
 */
async function canEditMessage(userId, messageId) {
  try {
    const messageDoc = await db
      .collection('messages')
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      return {
        allowed: false,
        reason: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      };
    }

    const messageData = messageDoc.data();
    
    // Check if user is the author
    if (messageData.authorId !== userId) {
      return {
        allowed: false,
        reason: 'NOT_AUTHOR',
        message: 'You can only edit your own messages',
      };
    }

    // Check if message is deleted
    if (messageData.isDeleted) {
      return {
        allowed: false,
        reason: 'MESSAGE_DELETED',
        message: 'Cannot edit deleted messages',
      };
    }

    // Check edit time window (15 minutes)
    const editWindow = 15 * 60 * 1000; // 15 minutes in milliseconds
    const messageAge = Date.now() - messageData.createdAt.toMillis();
    
    if (messageAge > editWindow) {
      return {
        allowed: false,
        reason: 'EDIT_WINDOW_EXPIRED',
        message: 'Messages can only be edited within 15 minutes',
      };
    }

    return {
      allowed: true,
      message: messageData,
    };
  } catch (error) {
    logger.error('Error checking edit message permission', {
      error: error.message,
      userId,
      messageId,
    });
    return {
      allowed: false,
      reason: 'ERROR',
      message: 'Error checking permissions',
    };
  }
}

/**
 * Check if user can delete a message
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} Permission check result
 */
async function canDeleteMessage(userId, messageId) {
  try {
    const messageDoc = await db
      .collection('messages')
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      return {
        allowed: false,
        reason: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      };
    }

    const messageData = messageDoc.data();
    
    // Check if user is the author or a moderator
    if (messageData.authorId !== userId) {
      // Check if user is moderator in the conversation
      const isMod = await isModerator(userId, messageData.conversationId);
      if (!isMod) {
        return {
          allowed: false,
          reason: 'NOT_AUTHOR_OR_MODERATOR',
          message: 'You can only delete your own messages',
        };
      }
    }

    // Check if message is already deleted
    if (messageData.isDeleted) {
      return {
        allowed: false,
        reason: 'MESSAGE_ALREADY_DELETED',
        message: 'Message is already deleted',
      };
    }

    return {
      allowed: true,
      message: messageData,
    };
  } catch (error) {
    logger.error('Error checking delete message permission', {
      error: error.message,
      userId,
      messageId,
    });
    return {
      allowed: false,
      reason: 'ERROR',
      message: 'Error checking permissions',
    };
  }
}

module.exports = {
  isParticipant,
  isModerator,
  isOwner,
  isBlocked,
  isConversationLocked,
  canSendMessage,
  canEditMessage,
  canDeleteMessage,
};
