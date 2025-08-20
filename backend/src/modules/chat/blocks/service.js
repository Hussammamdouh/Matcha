const { getFirestore } = require('firebase-admin/firestore');
const { createModuleLogger } = require('../../../lib/logger');

const logger = createModuleLogger('chat:blocks:service');
const db = getFirestore();

/**
 * Block a user
 * @param {string} userId - The user doing the blocking
 * @param {string} blockedUserId - The user being blocked
 * @returns {Promise<Object>} The block document
 */
async function blockUser(userId, blockedUserId) {
  try {
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    const blockId = `${userId}_${blockedUserId}`;
    const blockRef = db.collection('blocks').doc(blockId);

    const blockData = {
      userId,
      blockedUserId,
      createdAt: new Date(),
    };

    await blockRef.set(blockData);

    logger.info('User blocked', { userId, blockedUserId });

    return {
      id: blockId,
      ...blockData,
    };
  } catch (error) {
    logger.error('Failed to block user', { error: error.message, userId, blockedUserId });
    throw error;
  }
}

/**
 * Unblock a user
 * @param {string} userId - The user doing the unblocking
 * @param {string} blockedUserId - The user being unblocked
 * @returns {Promise<boolean>} Success status
 */
async function unblockUser(userId, blockedUserId) {
  try {
    const blockId = `${userId}_${blockedUserId}`;
    const blockRef = db.collection('blocks').doc(blockId);

    const blockDoc = await blockRef.get();
    if (!blockDoc.exists) {
      throw new Error('Block not found');
    }

    await blockRef.delete();

    logger.info('User unblocked', { userId, blockedUserId });

    return true;
  } catch (error) {
    logger.error('Failed to unblock user', { error: error.message, userId, blockedUserId });
    throw error;
  }
}

/**
 * Check if a user is blocked by another user
 * @param {string} userId - The user to check
 * @param {string} blockedUserId - The user who might be blocked
 * @returns {Promise<boolean>} True if blocked
 */
async function isBlocked(userId, blockedUserId) {
  try {
    if (userId === blockedUserId) {
      return false;
    }

    const blockId = `${userId}_${blockedUserId}`;
    const blockRef = db.collection('blocks').doc(blockId);

    const blockDoc = await blockRef.get();
    return blockDoc.exists;
  } catch (error) {
    logger.error('Failed to check block status', { error: error.message, userId, blockedUserId });
    return false; // Default to not blocked on error
  }
}

/**
 * Get list of users blocked by a specific user
 * @param {string} userId - The user whose blocks to retrieve
 * @param {Object} options - Query options
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.pageSize - Number of results per page
 * @returns {Promise<Object>} Paginated list of blocked users
 */
async function getBlockedUsers(userId, options = {}) {
  try {
    const { cursor, pageSize = 20 } = options;

    let query = db.collection('blocks')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(pageSize + 1); // +1 to check if there are more results

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    const blocks = [];

    snapshot.forEach(doc => {
      blocks.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    const hasMore = blocks.length > pageSize;
    const nextCursor = hasMore ? blocks[pageSize - 1] : null;

    if (hasMore) {
      blocks.pop(); // Remove the extra item
    }

    // Get user details for blocked users
    const blockedUserIds = blocks.map(block => block.blockedUserId);
    const usersSnapshot = await db.collection('users')
      .where('__name__', 'in', blockedUserIds)
      .get();

    const users = {};
    usersSnapshot.forEach(doc => {
      users[doc.id] = {
        id: doc.id,
        nickname: doc.data().nickname || 'Unknown User',
        avatarUrl: doc.data().avatarUrl || null,
      };
    });

    // Enhance blocks with user details
    const enhancedBlocks = blocks.map(block => ({
      ...block,
      blockedUser: users[block.blockedUserId] || {
        id: block.blockedUserId,
        nickname: 'Unknown User',
        avatarUrl: null,
      },
    }));

    return {
      blocks: enhancedBlocks,
      meta: {
        hasMore,
        nextCursor,
        total: enhancedBlocks.length,
      },
    };
  } catch (error) {
    logger.error('Failed to get blocked users', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get list of users who have blocked a specific user
 * @param {string} userId - The user to check who blocked them
 * @returns {Promise<Array>} List of user IDs who blocked this user
 */
async function getBlockedByUsers(userId) {
  try {
    const snapshot = await db.collection('blocks')
      .where('blockedUserId', '==', userId)
      .get();

    return snapshot.docs.map(doc => doc.data().userId);
  } catch (error) {
    logger.error('Failed to get blocked by users', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  blockUser,
  unblockUser,
  isBlocked,
  getBlockedUsers,
  getBlockedByUsers,
};
