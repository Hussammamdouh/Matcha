const { getFirestore } = require('firebase-admin/firestore');
const { createModuleLogger } = require('../../../lib/logger');

const logger = createModuleLogger('chat:reactions:service');
const db = getFirestore();

/**
 * Add a reaction to a message
 * @param {string} messageId - ID of the message
 * @param {string} userId - ID of the user adding the reaction
 * @param {string} value - Emoji or reaction value
 * @returns {Promise<Object>} The created reaction
 */
async function addReaction(messageId, userId, value) {
  try {
    // Validate reaction value (basic emoji validation)
    if (!value || typeof value !== 'string' || value.length > 10) {
      throw new Error('Invalid reaction value');
    }

    // Check if message exists
    const messageRef = db.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      throw new Error('Message not found');
    }

    const messageData = messageDoc.data();

    // Check if user is participant in the conversation
    const participantRef = db.collection('conversations')
      .doc(messageData.conversationId)
      .collection('participants')
      .doc(userId);

    const participantDoc = await participantRef.get();
    if (!participantDoc.exists) {
      throw new Error('User is not a participant in this conversation');
    }

    // Create reaction document
    const reactionRef = db.collection('messages')
      .doc(messageId)
      .collection('reactions')
      .doc(userId);

    const reactionData = {
      userId,
      value,
      createdAt: new Date(),
    };

    await reactionRef.set(reactionData);

    logger.info('Reaction added to message', {
      messageId,
      userId,
      value,
    });

    return {
      id: reactionRef.id,
      ...reactionData,
    };
  } catch (error) {
    logger.error('Failed to add reaction', {
      error: error.message,
      messageId,
      userId,
      value,
    });
    throw error;
  }
}

/**
 * Remove a reaction from a message
 * @param {string} messageId - ID of the message
 * @param {string} userId - ID of the user removing the reaction
 * @param {string} value - Emoji or reaction value to remove
 * @returns {Promise<boolean>} Success status
 */
async function removeReaction(messageId, userId, value) {
  try {
    // Check if message exists
    const messageRef = db.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      throw new Error('Message not found');
    }

    // Remove reaction document
    const reactionRef = db.collection('messages')
      .doc(messageId)
      .collection('reactions')
      .doc(userId);

    const reactionDoc = await reactionRef.get();

    if (!reactionDoc.exists) {
      throw new Error('Reaction not found');
    }

    const reactionData = reactionDoc.data();

    // Check if the reaction value matches
    if (reactionData.value !== value) {
      throw new Error('Reaction value mismatch');
    }

    await reactionRef.delete();

    logger.info('Reaction removed from message', {
      messageId,
      userId,
      value,
    });

    return true;
  } catch (error) {
    logger.error('Failed to remove reaction', {
      error: error.message,
      messageId,
      userId,
      value,
    });
    throw error;
  }
}

/**
 * Get reactions for a message
 * @param {string} messageId - ID of the message
 * @returns {Promise<Array>} Array of reactions
 */
async function getMessageReactions(messageId) {
  try {
    // Check if message exists
    const messageRef = db.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      throw new Error('Message not found');
    }

    const reactionsSnapshot = await db.collection('messages')
      .doc(messageId)
      .collection('reactions')
      .get();

    const reactions = [];

    reactionsSnapshot.forEach(doc => {
      reactions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Get user details for reactions
    const userIds = [...new Set(reactions.map(reaction => reaction.userId))];
    const usersSnapshot = await db.collection('users')
      .where('__name__', 'in', userIds)
      .get();

    const users = {};
    usersSnapshot.forEach(doc => {
      users[doc.id] = {
        id: doc.id,
        nickname: doc.data().nickname || 'Unknown User',
        avatarUrl: doc.data().avatarUrl || null,
      };
    });

    // Enhance reactions with user details
    const enhancedReactions = reactions.map(reaction => ({
      ...reaction,
      user: users[reaction.userId] || {
        id: reaction.userId,
        nickname: 'Unknown User',
        avatarUrl: null,
      },
    }));

    return enhancedReactions;
  } catch (error) {
    logger.error('Failed to get message reactions', {
      error: error.message,
      messageId,
    });
    throw error;
  }
}

/**
 * Get reaction summary for a message (count by value)
 * @param {string} messageId - ID of the message
 * @returns {Promise<Object>} Reaction counts by value
 */
async function getReactionSummary(messageId) {
  try {
    const reactions = await getMessageReactions(messageId);

    // Group reactions by value and count them
    const summary = {};
    reactions.forEach(reaction => {
      if (!summary[reaction.value]) {
        summary[reaction.value] = {
          count: 0,
          users: [],
        };
      }
      summary[reaction.value].count++;
      summary[reaction.value].users.push({
        id: reaction.userId,
        nickname: reaction.user.nickname,
        avatarUrl: reaction.user.avatarUrl,
      });
    });

    return summary;
  } catch (error) {
    logger.error('Failed to get reaction summary', {
      error: error.message,
      messageId,
    });
    throw error;
  }
}

/**
 * Check if a user has reacted to a message
 * @param {string} messageId - ID of the message
 * @param {string} userId - ID of the user
 * @returns {Promise<string|null>} Reaction value or null if no reaction
 */
async function getUserReaction(messageId, userId) {
  try {
    const reactionRef = db.collection('messages')
      .doc(messageId)
      .collection('reactions')
      .doc(userId);

    const reactionDoc = await reactionRef.get();

    if (!reactionDoc.exists) {
      return null;
    }

    return reactionDoc.data().value;
  } catch (error) {
    logger.error('Failed to get user reaction', {
      error: error.message,
      messageId,
      userId,
    });
    return null;
  }
}

module.exports = {
  addReaction,
  removeReaction,
  getMessageReactions,
  getReactionSummary,
  getUserReaction,
};
