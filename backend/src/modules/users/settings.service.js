const { getFirestore } = require('../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

const logger = createModuleLogger('users:settings:service');
let db;

/**
 * Get user settings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User settings
 */
async function getUserSettings(userId) {
  db = db || getFirestore();
  try {
    const settingsRef = db.collection('user_settings').doc(userId);
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      // Create default settings
      const defaultSettings = {
        accountPrivacy: 'public', // 'public' or 'private'
        showLikedPosts: true, // Whether to show liked posts publicly
        showFollowing: true, // Whether to show following list publicly
        showFollowers: true, // Whether to show followers list publicly
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await settingsRef.set(defaultSettings);
      return defaultSettings;
    }

    return settingsDoc.data();
  } catch (error) {
    logger.error('Failed to get user settings', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update user settings
 * @param {string} userId - User ID
 * @param {Object} settingsData - Settings to update
 * @returns {Promise<Object>} Updated settings
 */
async function updateUserSettings(userId, settingsData) {
  db = db || getFirestore();
  try {
    const settingsRef = db.collection('user_settings').doc(userId);
    
    // Validate settings data
    const allowedFields = ['accountPrivacy', 'showLikedPosts', 'showFollowing', 'showFollowers'];
    const updateData = {};
    
    for (const [key, value] of Object.entries(settingsData)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid settings fields provided');
    }

    updateData.updatedAt = new Date();

    await settingsRef.set(updateData, { merge: true });

    // Get updated settings
    const updatedDoc = await settingsRef.get();
    const updatedSettings = updatedDoc.data();

    logger.info('User settings updated', { userId, updatedFields: Object.keys(updateData) });

    return updatedSettings;
  } catch (error) {
    logger.error('Failed to update user settings', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's communities
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} User's communities with pagination
 */
async function getUserCommunities(userId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get all user's community memberships (simplified query without ordering to avoid index requirements)
    const membershipSnapshot = await db.collection('community_members')
      .where('userId', '==', userId)
      .get();

    // Process in memory for pagination and sorting
    let allMemberships = [];
    membershipSnapshot.forEach(doc => {
      allMemberships.push({ id: doc.id, ...doc.data() });
    });

    // Sort by joinedAt descending
    allMemberships.sort((a, b) => {
      const aTime = a.joinedAt?.toDate ? a.joinedAt.toDate() : new Date(a.joinedAt);
      const bTime = b.joinedAt?.toDate ? b.joinedAt.toDate() : new Date(b.joinedAt);
      return bTime - aTime;
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allMemberships.findIndex(m => m.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const memberships = allMemberships.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allMemberships.length;

    // Get community details for each membership
    const communities = [];
    if (memberships.length > 0) {
      const communityIds = memberships.map(m => m.communityId);
      const communitiesSnapshot = await db.collection('communities')
        .where('id', 'in', communityIds)
        .get();

      // Create a map for quick lookup
      const communityMap = {};
      communitiesSnapshot.forEach(doc => {
        const community = { id: doc.id, ...doc.data() };
        // Remove sensitive fields
        delete community.modIds;
        communityMap[doc.id] = community;
      });

      // Match memberships with communities and preserve order
      memberships.forEach(membership => {
        if (communityMap[membership.communityId]) {
          const community = communityMap[membership.communityId];
          const isOwner = community.ownerId === userId;
          const isModerator = (community.modIds || []).includes(userId);
          
          communities.push({
            ...community,
            userRole: membership.role,
            isOwner,
            isModerator,
            joinedAt: membership.joinedAt
          });
        }
      });
    }

    const nextCursor = hasMore ? memberships[memberships.length - 1]?.id : null;

    return {
      communities,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get user communities', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get detailed followers list
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Followers with user details
 */
async function getDetailedFollowers(userId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get all followers (simplified query without ordering to avoid index requirements)
    const followsSnapshot = await db.collection('follows')
      .where('followedId', '==', userId)
      .get();

    // Process in memory for pagination and sorting
    let allFollows = [];
    followsSnapshot.forEach(doc => {
      allFollows.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by createdAt descending
    allFollows.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return bTime - aTime;
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allFollows.findIndex(f => f.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedFollows = allFollows.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allFollows.length;
    const followerIds = paginatedFollows.map(f => f.followerId);

    // Get user details for followers
    const followers = [];
    if (followerIds.length > 0) {
      const usersSnapshot = await db.collection('users')
        .where('uid', 'in', followerIds)
        .get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        followers.push({
          uid: userData.uid,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null,
          bio: userData.bio || null,
          status: userData.status,
          createdAt: userData.createdAt,
        });
      });
    }

    const nextCursor = hasMore ? paginatedFollows[paginatedFollows.length - 1]?.id : null;

    return {
      followers,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get detailed followers', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get detailed following list
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Following with user details
 */
async function getDetailedFollowing(userId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get all following (simplified query without ordering to avoid index requirements)
    const followsSnapshot = await db.collection('follows')
      .where('followerId', '==', userId)
      .get();

    // Process in memory for pagination and sorting
    let allFollows = [];
    followsSnapshot.forEach(doc => {
      allFollows.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by createdAt descending
    allFollows.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return bTime - aTime;
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allFollows.findIndex(f => f.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedFollows = allFollows.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allFollows.length;
    const followingIds = paginatedFollows.map(f => f.followedId);

    // Get user details for following
    const following = [];
    if (followingIds.length > 0) {
      const usersSnapshot = await db.collection('users')
        .where('uid', 'in', followingIds)
        .get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        following.push({
          uid: userData.uid,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null,
          bio: userData.bio || null,
          status: userData.status,
          createdAt: userData.createdAt,
        });
      });
    }

    const nextCursor = hasMore ? paginatedFollows[paginatedFollows.length - 1]?.id : null;

    return {
      following,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get detailed following', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get detailed blocked users list
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Blocked users with user details
 */
async function getDetailedBlockedUsers(userId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get all blocked users (simplified query without ordering to avoid index requirements)
    const blocksSnapshot = await db.collection('blocks')
      .where('userId', '==', userId)
      .get();

    // Process in memory for pagination and sorting
    let allBlocks = [];
    blocksSnapshot.forEach(doc => {
      allBlocks.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by createdAt descending
    allBlocks.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return bTime - aTime;
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allBlocks.findIndex(b => b.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedBlocks = allBlocks.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allBlocks.length;
    const blockedUserIds = paginatedBlocks.map(b => b.blockedUserId);

    // Get user details for blocked users
    const blockedUsers = [];
    if (blockedUserIds.length > 0) {
      const usersSnapshot = await db.collection('users')
        .where('uid', 'in', blockedUserIds)
        .get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        blockedUsers.push({
          uid: userData.uid,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null,
          bio: userData.bio || null,
          status: userData.status,
          createdAt: userData.createdAt,
        });
      });
    }

    const nextCursor = hasMore ? paginatedBlocks[paginatedBlocks.length - 1]?.id : null;

    return {
      blockedUsers,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get detailed blocked users', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getUserSettings,
  updateUserSettings,
  getUserCommunities,
  getDetailedFollowers,
  getDetailedFollowing,
  getDetailedBlockedUsers,
};
